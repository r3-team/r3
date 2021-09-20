package cache

import (
	"r3/types"
)

var (
	// channel of client events
	// used for websocket handler to inform connected clients
	ClientEvent_handlerChan = make(chan types.ClientEvent, 10)
)
