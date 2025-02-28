package cache

import (
	"sync"

	"github.com/gofrs/uuid"
)

var (
	cluster_mx      sync.RWMutex
	isClusterMaster bool      // node is cluster master, only one is allowed
	nodeId          uuid.UUID // ID of node, self assigned on startup if not set
	nodeName        string    // name of node, self assigned on startup if not set, overwritable by admin
)

// is master
func GetIsClusterMaster() bool {
	cluster_mx.RLock()
	defer cluster_mx.RUnlock()
	return isClusterMaster
}
func SetIsClusterMaster(value bool) {
	cluster_mx.Lock()
	defer cluster_mx.Unlock()
	isClusterMaster = value
}

// node ID
func GetNodeId() uuid.UUID {
	cluster_mx.RLock()
	defer cluster_mx.RUnlock()
	return nodeId
}
func SetNodeId(value uuid.UUID) {
	cluster_mx.Lock()
	defer cluster_mx.Unlock()
	nodeId = value
}

// node name
func GetNodeName() string {
	cluster_mx.RLock()
	defer cluster_mx.RUnlock()
	return nodeName
}
func SetNodeName(value string) {
	cluster_mx.Lock()
	defer cluster_mx.Unlock()
	nodeName = value
}
