package cache

import (
	"github.com/gofrs/uuid"
)

var (
	isClusterMaster bool      // node is cluster master, only one is allowed
	nodeId          uuid.UUID // ID of node, self assigned on startup if not set
)

func GetIsClusterMaster() bool {
	return isClusterMaster
}
func SetIsClusterMaster(value bool) {
	isClusterMaster = value
}

func GetNodeId() uuid.UUID {
	return nodeId
}
func SetNodeId(value uuid.UUID) {
	nodeId = value
}
