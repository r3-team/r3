package cache

import "github.com/gofrs/uuid"

var (
	nodeId uuid.UUID // ID of node, self assigned on startup if not set
)

func GetNodeId() uuid.UUID {
	return nodeId
}
func SetNodeId(id uuid.UUID) {
	nodeId = id
}
