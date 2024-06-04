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

// cluster events
type ClusterEventTarget struct {
	Address string `json:"address"` // "" = IP is irrelevant (address used to connect via websocket)
	Device  string `json:"device"`  // "" = device is irrelevant ("browser", "fatClient")
	LoginId int64  `json:"loginId"` // 0  = all logins
}
type ClusterEvent struct {
	Content string
	Payload []byte
}
type ClusterEventCollectionUpdated struct {
	CollectionId uuid.UUID `json:"collectionId"`
	LoginIds     []int64   `json:"loginIds"`
}
type ClusterEventConfigChanged struct {
	SwitchToMaintenance bool `json:"switchToMaintenance"`
}
type ClusterEventFilesCopied struct {
	AttributeId uuid.UUID          `json:"attributeId"`
	FileIds     []uuid.UUID        `json:"fileIds"`
	RecordId    int64              `json:"recordId"`
	Target      ClusterEventTarget `json:"target"`
}
type ClusterEventFileRequested struct {
	AttributeId uuid.UUID          `json:"attributeId"`
	ChooseApp   bool               `json:"chooseApp"`
	FileId      uuid.UUID          `json:"fileId"`
	FileHash    string             `json:"fileHash"`
	FileName    string             `json:"fileName"`
	Target      ClusterEventTarget `json:"target"`
}
type ClusterEventJsFunctionCalled struct {
	JsFunctionId uuid.UUID          `json:"jsFunctionId"`
	Arguments    []interface{}      `json:"arguments"`
	Target       ClusterEventTarget `json:"target"`
}
type ClusterEventLogin struct {
	Target ClusterEventTarget `json:"target"`
}
type ClusterEventMasterAssigned struct {
	State bool `json:"state"`
}
type ClusterEventSchemaChanged struct {
	ModuleIds []uuid.UUID `json:"moduleIds"`
}
type ClusterEventTaskTriggered struct {
	PgFunctionId         uuid.UUID `json:"pgFunctionId"`
	PgFunctionScheduleId uuid.UUID `json:"pgFunctionScheduleId"`
	TaskName             string    `json:"taskName"`
}

// an event to be distributed to websocket clients
// can be filtered to only clients with associated login ID or IP address
type ClusterWebsocketClientEvent struct {
	Target ClusterEventTarget `json:"target"` // target filter, to which clients this event is to be sent

	CollectionChanged uuid.UUID // inform client: collection has changed (should update it)
	ConfigChanged     bool      // system config has changed (only relevant for admins)
	Kick              bool      // kick login (usually because it was disabled)
	KickNonAdmin      bool      // kick login if not admin (usually because maintenance mode was enabled)
	Renew             bool      // renew login (permissions changed)
	SchemaLoading     bool      // inform client: schema is loading
	SchemaLoaded      bool      // inform client: schema has been loaded

	// file open request for fat client
	FileRequestedAttributeId uuid.UUID
	FileRequestedChooseApp   bool
	FileRequestedFileId      uuid.UUID
	FileRequestedFileHash    string
	FileRequestedFileName    string

	// file copy request
	FilesCopiedAttributeId uuid.UUID
	FilesCopiedFileIds     []uuid.UUID
	FilesCopiedRecordId    int64

	// JS function call
	JsFunctionCalledJsFunctionId uuid.UUID
	JsFunctionCalledArguments    []interface{}
}
