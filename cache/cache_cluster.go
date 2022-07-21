package cache

import (
	"os"

	"github.com/gofrs/uuid"
)

var (
	hostname        string
	isClusterMaster bool      // node is cluster master, only one is allowed
	nodeId          uuid.UUID // ID of node, self assigned on startup if not set
	nodeName        string    // name of node, self assigned on startup if not set, overwritable by admin
)

func GetHostname() string {
	return hostname
}
func SetHostnameFromOs() error {
	var err error
	hostname, err = os.Hostname()
	return err
}

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

func GetNodeName() string {
	return nodeName
}
func SetNodeName(value string) {
	nodeName = value
}
