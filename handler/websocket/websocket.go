package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"r3/bruteforce"
	"r3/cache"
	"r3/cluster"
	"r3/config"
	"r3/handler"
	"r3/log"
	"r3/login/login_session"
	"r3/request"
	"r3/types"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gofrs/uuid"
	"github.com/gorilla/websocket"
)

// a websocket client
type clientType struct {
	id        uuid.UUID                   // unique ID for client (for registering/de-registering login sessions)
	address   string                      // IP address, no port
	admin     bool                        // belongs to admin login?
	ctx       context.Context             // global context for client requests
	ctxCancel context.CancelFunc          // to abort requests in case of disconnect
	device    types.WebsocketClientDevice // client device type (browser, fatClient)
	ioFailure atomic.Bool                 // client failed to read/write
	local     bool                        // client is local (::1, 127.0.0.1)
	loginId   int64                       // client login ID, 0 = not logged in yet
	noAuth    bool                        // logged in without authentication (public auth, username only)
	write_mx  sync.Mutex                  // to force sequential writes
	ws        *websocket.Conn             // websocket connection
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

	// limit concurrent requests to 10, regardless of client count
	// known issue: if 10+ requests occur during schema reload, server hangs
	// we traced the issue to the DB requests but there are no visible issues in Postgres or pgx
	// 10 concurrently handled requests are more than reasonable - a workaround is fine for now
	// we plan to upgrade to pgx v5 soon and will revisit the issue then
	hubRequestLimit = make(chan bool, 10)
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

	// get client host address
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	// create unique client ID for session tracking
	clientId, err := uuid.NewV4()
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	// upgrade to websocket
	ws, err := clientUpgrader.Upgrade(w, r, nil)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	// create global request context with abort function
	ctx, ctxCancel := context.WithCancel(context.Background())
	client := &clientType{
		id:        clientId,
		address:   host,
		admin:     false,
		ctx:       ctx,
		ctxCancel: ctxCancel,
		device:    types.WebsocketClientDeviceBrowser,
		local:     host == "::1" || host == "127.0.0.1",
		loginId:   0,
		noAuth:    false,
		write_mx:  sync.Mutex{},
		ws:        ws,
	}

	if r.Header.Get("User-Agent") == "r3-client-fat" {
		client.device = types.WebsocketClientDeviceFatClient
	}

	hub.clientAdd <- client
	go client.read()
}

func (hub *hubType) start() {

	var removeClient = func(client *clientType, wasKicked bool) {
		if _, exists := hub.clients[client]; !exists {
			return
		}

		if !client.ioFailure.Load() {
			client.write_mx.Lock()
			client.ws.WriteMessage(websocket.CloseMessage, []byte{})
			client.write_mx.Unlock()
		}
		client.ws.Close()
		client.ctxCancel()
		delete(hub.clients, client)

		// run DB calls in async func as they must not block hub operations during heavy DB load
		go func() {
			if wasKicked {
				log.Info(handlerContext, fmt.Sprintf("kicked client (login ID %d) at %s", client.loginId, client.address))
			} else {
				log.Info(handlerContext, fmt.Sprintf("disconnected client (login ID %d) at %s", client.loginId, client.address))
			}
			if err := login_session.LogRemove(client.id); err != nil {
				log.Error(handlerContext, "failed to remove login session log", err)
			}
		}()
	}

	for {
		// hub is only handled here, no locking is required
		select {
		case client := <-hub.clientAdd:
			hub.clients[client] = true

		case client := <-hub.clientDel:
			removeClient(client, false)

		case event := <-cluster.WebsocketClientEvents:

			// prepare json message for client(s) based on event content
			var err error = nil
			jsonMsg := []byte{}      // message back to client
			singleRecipient := false // message is only sent to single recipient (first valid one)

			switch event.Content {
			case "clientEventsChanged":
				jsonMsg, err = prepareUnrequested("clientEventsChanged", nil)
			case "collectionChanged":
				jsonMsg, err = prepareUnrequested("collectionChanged", event.Payload)
			case "configChanged":
				jsonMsg, err = prepareUnrequested("configChanged", nil)
			case "filesCopied":
				jsonMsg, err = prepareUnrequested("filesCopied", event.Payload)
			case "fileRequested":
				jsonMsg, err = prepareUnrequested("fileRequested", event.Payload)
			case "jsFunctionCalled":
				jsonMsg, err = prepareUnrequested("jsFunctionCalled", event.Payload)
				singleRecipient = true
			case "keystrokesRequested":
				jsonMsg, err = prepareUnrequested("keystrokesRequested", event.Payload)
				singleRecipient = true
			case "renew":
				jsonMsg, err = prepareUnrequested("reauthorized", nil)
			case "schemaLoaded":
				data := struct {
					ModuleIdMapData     map[uuid.UUID]types.ModuleMeta `json:"moduleIdMapData"`
					PresetIdMapRecordId map[uuid.UUID]int64            `json:"presetIdMapRecordId"`
					CaptionMapCustom    types.CaptionMapsAll           `json:"captionMapCustom"`
				}{
					ModuleIdMapData:     cache.GetModuleIdMapMeta(),
					PresetIdMapRecordId: cache.GetPresetRecordIds(),
					CaptionMapCustom:    cache.GetCaptionMapCustom(),
				}
				jsonMsg, err = prepareUnrequested("schemaLoaded", data)
			case "schemaLoading":
				jsonMsg, err = prepareUnrequested("schemaLoading", nil)
			}

			if err != nil {
				// run DB calls in async func as they must not block hub operations during heavy DB load
				go log.Error(handlerContext, "could not prepare unrequested transaction", err)
				continue
			}

			eventLocal := event.Target.Address == "::1" || event.Target.Address == "127.0.0.1"

			for client, _ := range hub.clients {
				bothLocal := eventLocal && client.local

				// skip if target filter does not apply to client
				if (event.Target.Address != "" && event.Target.Address != client.address && !bothLocal) ||
					(event.Target.Device != 0 && event.Target.Device != client.device) ||
					(event.Target.LoginId != 0 && event.Target.LoginId != client.loginId) {
					continue
				}

				// disconnect and do not send message if kicked
				if event.Content == "kick" || (event.Content == "kickNonAdmin" && !client.admin) {
					removeClient(client, true)
					continue
				}

				go client.write(jsonMsg)

				if singleRecipient {
					break
				}
			}
		}
	}
}

func (client *clientType) read() {
	for {
		_, message, err := client.ws.ReadMessage()
		if err != nil {
			client.ioFailure.Store(true)
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
		client.ioFailure.Store(true)
		hub.clientDel <- client
		return
	}
}

func (client *clientType) handleTransaction(reqTransJson json.RawMessage) json.RawMessage {
	hubRequestLimit <- true
	defer func() {
		<-hubRequestLimit
	}()

	var (
		reqTrans types.RequestTransaction
		resTrans types.ResponseTransaction
	)

	// umarshal user input, this can always fail (never trust user input)
	if err := json.Unmarshal(reqTransJson, &reqTrans); err != nil {
		log.Error(handlerContext, "failed to unmarshal transaction", err)
		return []byte("{}")
	}

	log.Info(handlerContext, fmt.Sprintf("TRANSACTION %d, started by login ID %d (%s)",
		reqTrans.TransactionNr, client.loginId, client.address))

	// take over transaction number for response so client can match it locally
	resTrans.TransactionNr = reqTrans.TransactionNr

	// client can either authenticate or execute requests
	authRequest := len(reqTrans.Requests) == 1 && reqTrans.Requests[0].Ressource == "auth"

	if !authRequest {
		// execute non-authentication transaction
		ctx, ctxCanc := context.WithTimeout(client.ctx,
			time.Duration(int64(config.GetUint64("dbTimeoutDataWs")))*time.Second)

		defer ctxCanc()

		resTrans = request.ExecTransaction(ctx, client.address, client.loginId,
			client.admin, client.device, client.noAuth, reqTrans, resTrans)

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
		case "token": // authentication via JSON web token
			resPayload, err = request.LoginAuthToken(req.Payload,
				&client.loginId, &client.admin, &client.noAuth)

		case "tokenFixed": // authentication via fixed token (fat-client only)
			resPayload, err = request.LoginAuthTokenFixed(req.Payload, &client.loginId)
			client.device = types.WebsocketClientDeviceFatClient

		case "user": // authentication via credentials
			resPayload, err = request.LoginAuthUser(req.Payload,
				&client.loginId, &client.admin, &client.noAuth)
		}

		if err != nil {
			log.Warning(handlerContext, "failed to authenticate user", err)
			bruteforce.BadAttemptByHost(client.address)

			if handler.CheckForLicenseErrCode(err) {
				// license errors are relevant to the client
				resTrans.Error = err.Error()
			} else {
				// any other error is not relevant to the client and could reveal internals
				resTrans.Error = "AUTH_ERROR"
			}
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
			log.Info(handlerContext, fmt.Sprintf("authenticated client (login ID %d, admin: %v)",
				client.loginId, client.admin))

			if err := login_session.Log(client.id, client.loginId, client.address, client.device); err != nil {
				log.Error(handlerContext, "failed to create login session log", err)
			}
		}
	}

	// marshal response transaction
	resTransJson, err := json.Marshal(resTrans)
	if err != nil {
		log.Error(handlerContext, "cannot marshal responses", err)
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
