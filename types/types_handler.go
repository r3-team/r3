package types

// a server side event, affecting one or many clients (by associated login ID)
type ClientEvent struct {
	LoginId         int64 // affected login (0=all logins)
	BuilderOff      bool  // inform client: builder mode disabled
	BuilderOn       bool  // inform client: builder mode enabled
	Kick            bool  // kick login (usually because it was disabled)
	KickNonAdmin    bool  // kick login if not admin (usually because maintenance mode was enabled)
	Renew           bool  // renew login (permissions changed)
	SchemaLoading   bool  // inform client: schema is loading
	SchemaTimestamp int64 // inform client: schema has a new timestamp (new version)
}
