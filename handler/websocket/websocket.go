package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"r3/bruteforce"
	"r3/cache"
	"r3/handler"
	"r3/log"
	"r3/request"
	"r3/types"
	"sync"

	"github.com/gorilla/websocket"
)

// a specific, active websocket client
type clientType struct {
	address   string             // IP address, no port
	admin     bool               // is admin?
	change_mx sync.Mutex         // mutex for safely changing client
	ctx       context.Context    // global context for client requests
	ctxCancel context.CancelFunc // to abort requests in case of disconnect
	loginId   int64              // client login ID, 0 = not logged in yet
	noAuth    bool               // logged in without authentication (username only)
	send      chan []byte        // websocket send channel
	sendOpen  bool               // websocket send channel open?
	ws        *websocket.Conn    // websocket connection
}

// a hub for all active websocket clients
// clients can only be added/removed via the single, central hub
type hubType struct {
	broadcast chan []byte
	clients   map[*clientType]bool
	add       chan *clientType
	remove    chan *clientType
}

var (
	clientUpgrader = websocket.Upgrader{}
	handlerContext = "websocket"
	hub_mx         sync.Mutex // mutex for safely changing websocket hub

	hub = hubType{
		clients:   make(map[*clientType]bool),
		add:       make(chan *clientType),
		remove:    make(chan *clientType),
		broadcast: make(chan []byte),
	}
)

func StartBackgroundTasks() {
	go hub.start()
	go handleClientEvents()
}

// handles websocket client
func Handler(w http.ResponseWriter, r *http.Request) {

	// bruteforce check must occur before websocket connection is established
	// otherwise the HTTP writer is hijacked
	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	conn, err := clientUpgrader.Upgrade(w, r, nil)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	// get client host address
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	log.Info("server", fmt.Sprintf("new client connecting from %s", host))

	// create global request context with abort function
	ctx, ctxCancel := context.WithCancel(context.Background())

	client := &clientType{
		address:   host,
		admin:     false,
		change_mx: sync.Mutex{},
		ctx:       ctx,
		ctxCancel: ctxCancel,
		loginId:   0,
		noAuth:    false,
		send:      make(chan []byte),
		sendOpen:  true,
		ws:        conn,
	}

	hub.add <- client

	go client.write()
	go client.read()
}

func (hub *hubType) start() {
	for {
		select {
		case client := <-hub.add:
			hub_mx.Lock()
			hub.clients[client] = true
			hub_mx.Unlock()

		case client := <-hub.remove:
			hub_mx.Lock()
			if _, exists := hub.clients[client]; exists {
				client.change_mx.Lock()
				log.Info("server", fmt.Sprintf("disconnecting client at %s", client.address))
				delete(hub.clients, client)
				close(client.send)
				client.ctxCancel()
				client.sendOpen = false
				client.ws.Close()
				client.change_mx.Unlock()
			}
			hub_mx.Unlock()

		case message := <-hub.broadcast:
			for client := range hub.clients {
				select {
				case client.send <- message:
				default: // client send channel is full
					log.Warning("server", "websocket", fmt.Errorf("client channel is full"))
					hub.remove <- client
				}
			}
		}
	}
}

func (client *clientType) read() {
	for {
		_, message, err := client.ws.ReadMessage()
		if err != nil {
			hub.remove <- client
			return
		}

		// do not wait for result to allow parallel requests
		// useful for new requests after aborting long running requests
		go func() {
			result := client.handleTransaction(message)

			client.change_mx.Lock()
			if client.sendOpen {
				client.send <- result
			}
			client.change_mx.Unlock()
		}()
	}
}

func (client *clientType) write() {
	for {
		select {
		case message, open := <-client.send:
			if !open {
				client.ws.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := client.ws.WriteMessage(websocket.TextMessage, message); err != nil {
				hub.remove <- client
				return
			}
		}
	}
}

func (client *clientType) sendUnrequested(ressource string, payload interface{}) {

	var resTrans types.UnreqResponseTransaction
	resTrans.TransactionNr = 0 // transaction was not requested

	payloadJson, err := json.Marshal(payload)
	if err != nil {
		return
	}

	resTrans.Responses = make([]types.UnreqResponse, 1)
	resTrans.Responses[0].Payload = payloadJson
	resTrans.Responses[0].Ressource = ressource
	resTrans.Responses[0].Result = "OK"

	transJson, err := json.Marshal(resTrans)
	if err != nil {
		return
	}

	client.change_mx.Lock()
	defer client.change_mx.Unlock()

	if client.sendOpen {
		client.send <- []byte(transJson)
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
			hub.remove <- client
			return []byte("{}")
		}

		switch req.Action {
		case "token":
			// authentication via token
			if _, err := request.AuthToken(req.Payload, &client.loginId,
				&client.admin, &client.noAuth); err != nil {

				log.Warning("server", "failed to authenticate user", err)
				bruteforce.BadAttemptByHost(client.address)
				resTrans.Error = "AUTH_ERROR"
			}
		case "user":
			// authentication via credentials
			resPayload, err := request.AuthUser(req.Payload, &client.loginId,
				&client.admin, &client.noAuth)

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

// client events from outside the websocket handler
func handleClientEvents() {
	for {
		event := <-cache.ClientEvent_handlerChan

		for client, _ := range hub.clients {

			// login ID 0 affects all
			if event.LoginId != 0 && event.LoginId != client.loginId {
				continue
			}

			// ask client to renew authorization cache
			if event.Renew {
				client.sendUnrequested("reauthorized", nil)
			}

			// kick client
			if event.Kick {
				log.Info("server", fmt.Sprintf("kicking client (login ID %d)",
					client.loginId))

				hub.remove <- client
			}

			// kick non-admin
			if event.KickNonAdmin && !client.admin {
				log.Info("server", fmt.Sprintf("kicking non-admin client (login ID %d)",
					client.loginId))

				hub.remove <- client
			}

			// inform clients about schema events
			if event.SchemaLoading {
				client.sendUnrequested("schema_loading", nil)
			}
			if event.SchemaTimestamp != 0 {
				client.sendUnrequested("schema_loaded", event.SchemaTimestamp)
			}
		}
	}
}
