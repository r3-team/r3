package types

import "github.com/gofrs/uuid"

type ClusterEvent struct {
	Content string
	Payload []byte
}
type ClusterEventConfigChanged struct {
	SwitchToMaintenance bool `json:"switchToMaintenance"`
}
type ClusterEventLogin struct {
	LoginId int64 `json:"loginId"`
}
type ClusterEventMasterAssigned struct {
	State bool `json:"state"`
}
type ClusterEventSchemaChanged struct {
	ModuleIdsUpdateOnly []uuid.UUID `json:"moduleIdsUpdateOnly"`
	NewVersion          bool        `json:"newVersion"`
}
type ClusterEventTaskTriggered struct {
	PgFunctionId         uuid.UUID `json:"pgFunctionId"`
	PgFunctionScheduleId uuid.UUID `json:"pgFunctionScheduleId"`
	TaskName             string    `json:"taskName"`
}

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

// a server side event, affecting one or many websocket clients (by associated login ID)
type ClusterWebsocketClientEvent struct {
	ConfigChanged   bool  // system config has changed (only relevant for admins)
	LoginId         int64 // affected login (0=all logins)
	Kick            bool  // kick login (usually because it was disabled)
	KickNonAdmin    bool  // kick login if not admin (usually because maintenance mode was enabled)
	Renew           bool  // renew login (permissions changed)
	SchemaLoading   bool  // inform client: schema is loading
	SchemaTimestamp int64 // inform client: schema has a new timestamp (new version)
}
