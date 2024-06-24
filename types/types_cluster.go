package types

import "github.com/gofrs/uuid"

// cluster node
type ClusterNode struct {
	ClusterMaster bool      `json:"clusterMaster"`
	DateCheckIn   int64     `json:"dateCheckIn"`
	DateStarted   int64     `json:"dateStarted"`
	Hostname      string    `json:"hostname"`
	Id            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	Running       bool      `json:"running"`
	StatSessions  int64     `json:"statSessions"`
	StatMemory    int64     `json:"statMemory"`
}

// cluster event payloads filled by functions
type ClusterEventCollectionUpdated struct {
	// filled by instance.update_collection()
	CollectionId uuid.UUID `json:"collectionId"`
	LoginIds     []int64   `json:"loginIds"`
}
type ClusterEventMasterAssigned struct {
	// filled by instance_cluster.master_role_request()
	State bool `json:"state"`
}
type ClusterEventTaskTriggered struct {
	// filled by instance_cluster.run_task()
	PgFunctionId         uuid.UUID `json:"pgFunctionId"`
	PgFunctionScheduleId uuid.UUID `json:"pgFunctionScheduleId"`
	TaskName             string    `json:"taskName"`
}

// cluster event payloads for inter-device communication
type ClusterEventDeviceBrowserApplyCopiedFiles struct {
	AttributeId uuid.UUID   `json:"attributeId"`
	FileIds     []uuid.UUID `json:"fileIds"`
	RecordId    int64       `json:"recordId"`
}
type ClusterEventDeviceBrowserCallJsFunction struct {
	JsFunctionId uuid.UUID     `json:"jsFunctionId"`
	Arguments    []interface{} `json:"arguments"`
}
type ClusterEventDeviceFatClientRequestFile struct {
	AttributeId uuid.UUID `json:"attributeId"`
	ChooseApp   bool      `json:"chooseApp"`
	FileId      uuid.UUID `json:"fileId"`
	FileHash    string    `json:"fileHash"`
	FileName    string    `json:"fileName"`
}

// cluster event client target filter
type ClusterEventTarget struct {
	Address string `json:"address"` // address used to connect via websocket, "" = address is irrelevant
	Device  string `json:"device"`  // device to affect ("browser", "fatClient"), "" = device is irrelevant
	LoginId int64  `json:"loginId"` // login ID to affect, 0 = all logins
}

// cluster event to be processed by nodes and, in most cases, to be distributed to clients of cluster nodes
type ClusterEvent struct {
	Target  ClusterEventTarget `json:"target"`  // target filter, to which clients this event is to be sent
	Content string             `json:"content"` // collectionChanged, configChanged, kick, kickNoAdmin, renew, schemaLoading, schemaLoaded
	Payload interface{}        `json:"payload"`
}
