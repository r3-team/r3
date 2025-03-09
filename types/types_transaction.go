package types

import "encoding/json"

type Request struct {
	Ressource string          `json:"ressource"`
	Action    string          `json:"action"`
	Payload   json.RawMessage `json:"payload"`
}
type RequestTransaction struct {
	TransactionNr uint64    `json:"transactionNr"` // for websocket client to match asynchronous response to original request
	Requests      []Request `json:"requests"`      // all websocket client requests
}
type Response struct {
	Payload json.RawMessage `json:"payload"`
}
type ResponseTransaction struct {
	TransactionNr uint64     `json:"transactionNr"`
	Responses     []Response `json:"responses"`
	Error         string     `json:"error"`
}

// special case - replace by common types?
// unrequested response type
type UnreqResponse struct {
	Ressource string          `json:"ressource"`
	Result    string          `json:"result"`
	Payload   json.RawMessage `json:"payload"`
}
type UnreqResponseTransaction struct {
	TransactionNr uint64          `json:"transactionNr"`
	Responses     []UnreqResponse `json:"responses"`
}
