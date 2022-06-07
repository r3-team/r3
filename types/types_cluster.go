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

// a server side event, affecting one or many clients (by associated login ID)
type ClusterWebsocketClientEvent struct {
	ConfigChanged   bool  // system config has changed (only relevant for admins)
	LoginId         int64 // affected login (0=all logins)
	Kick            bool  // kick login (usually because it was disabled)
	KickNonAdmin    bool  // kick login if not admin (usually because maintenance mode was enabled)
	Renew           bool  // renew login (permissions changed)
	SchemaLoading   bool  // inform client: schema is loading
	SchemaTimestamp int64 // inform client: schema has a new timestamp (new version)
}
