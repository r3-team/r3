package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"r3/bruteforce"
	"r3/cluster"
	"r3/handler"
	"r3/log"
	"r3/request"
	"r3/types"
	"sync"

	"github.com/gofrs/uuid"
	"github.com/gorilla/websocket"
)

// a websocket client
type clientType struct {
	address   string             // IP address, no port
	admin     bool               // belongs to admin login?
	ctx       context.Context    // global context for client requests
	ctxCancel context.CancelFunc // to abort requests in case of disconnect
	loginId   int64              // client login ID, 0 = not logged in yet
	noAuth    bool               // logged in without authentication (username only)
	write_mx  sync.Mutex
	ws        *websocket.Conn // websocket connection
}

// a hub for all active websocket clients
type hubType struct {
	clients map[*clientType]bool

	// action channels
	clientAdd chan *clientType // add client to hub
	clientDel chan *clientType // delete client from hub
}

var (
	clientUpgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024}

	handlerContext = "websocket"

	hub = hubType{
		clients:   make(map[*clientType]bool),
		clientAdd: make(chan *clientType),
		clientDel: make(chan *clientType),
	}
)

func StartBackgroundTasks() {
	go hub.start()
}

func Handler(w http.ResponseWriter, r *http.Request) {

	// bruteforce check must occur before websocket connection is established
	// otherwise the HTTP writer is not usable (hijacked for websocket)
	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	ws, err := clientUpgrader.Upgrade(w, r, nil)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	// get client host address
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		ws.Close()
		return
	}

	log.Info("server", fmt.Sprintf("new client connecting from %s", host))

	// create global request context with abort function
	ctx, ctxCancel := context.WithCancel(context.Background())

	client := &clientType{
		address:   host,
		admin:     false,
		ctx:       ctx,
		ctxCancel: ctxCancel,
		loginId:   0,
		noAuth:    false,
		write_mx:  sync.Mutex{},
		ws:        ws,
	}

	hub.clientAdd <- client

	go client.read()
}

func (hub *hubType) start() {

	var removeClient = func(client *clientType) {
		if _, exists := hub.clients[client]; exists {
			log.Info("server", fmt.Sprintf("disconnecting client at %s", client.address))
			client.ws.WriteMessage(websocket.CloseMessage, []byte{}) // optional
			client.ws.Close()
			client.ctxCancel()
			delete(hub.clients, client)
			cluster.SetWebsocketClientCount(len(hub.clients))
		}
	}

	for {
		// hub is only handled here, no locking is required
		select {
		case client := <-hub.clientAdd:
			hub.clients[client] = true
			cluster.SetWebsocketClientCount(len(hub.clients))

		case client := <-hub.clientDel:
			removeClient(client)

		case event := <-cluster.WebsocketClientEvents:

			jsonMsg := []byte{} // message back to client
			kickEvent := event.Kick || event.KickNonAdmin

			if !kickEvent {
				// if clients are not kicked, prepare response
				var err error

				if event.CollectionChanged != uuid.Nil {
					jsonMsg, err = prepareUnrequested("collection_changed", event.CollectionChanged)
				}
				if event.ConfigChanged {
					jsonMsg, err = prepareUnrequested("config_changed", nil)
				}
				if event.Renew {
					jsonMsg, err = prepareUnrequested("reauthorized", nil)
				}
				if event.SchemaLoading {
					jsonMsg, err = prepareUnrequested("schema_loading", nil)
				}
				if event.SchemaTimestamp != 0 {
					jsonMsg, err = prepareUnrequested("schema_loaded", event.SchemaTimestamp)
				}
				if err != nil {
					log.Error("server", "could not prepare unrequested transaction", err)
					continue
				}
			}

			for client, _ := range hub.clients {

				// login ID 0 affects all
				if event.LoginId != 0 && event.LoginId != client.loginId {
					continue
				}

				// non-kick event, send message
				if !kickEvent {
					go client.write(jsonMsg)
				}

				// kick client, if requested
				if event.Kick || (event.KickNonAdmin && !client.admin) {
					log.Info("server", fmt.Sprintf("kicking client (login ID %d)",
						client.loginId))

					removeClient(client)
				}
			}
		}
	}
}

func (client *clientType) read() {
	for {
		_, message, err := client.ws.ReadMessage()
		if err != nil {
			hub.clientDel <- client
			return
		}

		// do not wait for response to allow for parallel requests
		go func() {
			client.write(client.handleTransaction(message))
		}()
	}
}

func (client *clientType) write(message []byte) {
	client.write_mx.Lock()
	defer client.write_mx.Unlock()

	if err := client.ws.WriteMessage(websocket.TextMessage, message); err != nil {
		hub.clientDel <- client
		return
	}
}

func (client *clientType) handleTransaction(reqTransJson json.RawMessage) json.RawMessage {

	var (
		reqTrans types.RequestTransaction
		resTrans types.ResponseTransaction
	)

	// umarshal user input, this can always fail (never trust user input)
	if err := json.Unmarshal(reqTransJson, &reqTrans); err != nil {
		log.Error("server", "failed to unmarshal transaction", err)
		return []byte("{}")
	}

	log.Info("server", fmt.Sprintf("TRANSACTION %d, started by login ID %d (%s)",
		reqTrans.TransactionNr, client.loginId, client.address))

	// take over transaction number for response so client can match it locally
	resTrans.TransactionNr = reqTrans.TransactionNr

	// user can either authenticate or execute requests
	authRequest := len(reqTrans.Requests) == 1 && reqTrans.Requests[0].Ressource == "auth"

	if !authRequest {
		// execute non-authentication transaction
		resTrans = request.ExecTransaction(client.ctx, client.loginId,
			client.admin, client.noAuth, reqTrans, resTrans)

	} else {
		// execute authentication request
		var req = reqTrans.Requests[0]
		resTrans.Responses = make([]types.Response, 0)

		if blocked := bruteforce.CheckByHost(client.address); blocked {
			hub.clientDel <- client
			return []byte("{}")
		}

		var err error
		var resPayload interface{}

		switch req.Action {
		case "token": // authentication via token
			resPayload, err = request.LoginAuthToken(req.Payload, &client.loginId,
				&client.admin, &client.noAuth)

		case "user": // authentication via credentials
			resPayload, err = request.LoginAuthUser(req.Payload, &client.loginId,
				&client.admin, &client.noAuth)
		}

		if err != nil {
			log.Warning("server", "failed to authenticate user", err)
			bruteforce.BadAttemptByHost(client.address)
			resTrans.Error = "AUTH_ERROR"
		} else {
			var res types.Response
			res.Payload, err = json.Marshal(resPayload)
			if err != nil {
				resTrans.Error = handler.ErrGeneral
			} else {
				resTrans.Responses = append(resTrans.Responses, res)
			}
		}

		if resTrans.Error == "" {
			log.Info("server", fmt.Sprintf("authenticated client (login ID %d, admin: %v)",
				client.loginId, client.admin))
		}
	}

	// marshal response transaction
	resTransJson, err := json.Marshal(resTrans)
	if err != nil {
		log.Error("server", "cannot marshal responses", err)
		return []byte("{}")
	}
	return resTransJson
}

func prepareUnrequested(ressource string, payload interface{}) ([]byte, error) {

	var resTrans types.UnreqResponseTransaction
	resTrans.TransactionNr = 0 // transaction was not requested

	payloadJson, err := json.Marshal(payload)
	if err != nil {
		return []byte{}, err
	}

	resTrans.Responses = make([]types.UnreqResponse, 1)
	resTrans.Responses[0].Payload = payloadJson
	resTrans.Responses[0].Ressource = ressource
	resTrans.Responses[0].Result = "OK"

	transJson, err := json.Marshal(resTrans)
	if err != nil {
		return []byte{}, err
	}
	return transJson, nil
}
