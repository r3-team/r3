package types

import (
	"encoding/json"
)

// a module transfer file
// contains its content (all module data based on module schema)
// signature verifies content (export key is used to sign)
type TransferFile struct {
	Content struct {
		Module Module `json:"module"`
	} `json:"content"` // might not match signature after unmarshal (schema changes)

	Signature string `json:"signature"`
}

// verification version of module transfer file
// content is parsed as raw message because module schema might have changed between versions
// verification checks whether the stored bytes fit the signature, not a possible updated schema
type TransferFileVerify struct {
	Content   json.RawMessage `json:"content"`   // content to check signature against
	Signature string          `json:"signature"` // signature of content hash
}
