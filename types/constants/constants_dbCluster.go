package constants

import "r3/types"

const (
	// ENUM types in instance schema
	ClusterEventContentClientEventsChanged  types.ClusterEventContent = "clientEventsChanged"
	ClusterEventContentCollectionUpdated    types.ClusterEventContent = "collectionUpdated"
	ClusterEventContentConfigChanged        types.ClusterEventContent = "configChanged"
	ClusterEventContentDbSyncChanged        types.ClusterEventContent = "dbSyncChanged"
	ClusterEventContentFileRequested        types.ClusterEventContent = "fileRequested"
	ClusterEventContentFilesCopied          types.ClusterEventContent = "filesCopied"
	ClusterEventContentJsFunctionCalled     types.ClusterEventContent = "jsFunctionCalled"
	ClusterEventContentKeystrokesRequested  types.ClusterEventContent = "keystrokesRequested"
	ClusterEventContentKick                 types.ClusterEventContent = "kick"
	ClusterEventContentKickNonAdmin         types.ClusterEventContent = "kickNonAdmin"
	ClusterEventContentLdapsChanged         types.ClusterEventContent = "ldapsChanged"
	ClusterEventContentLoginDisabled        types.ClusterEventContent = "loginDisabled"
	ClusterEventContentLoginReauthorized    types.ClusterEventContent = "loginReauthorized"
	ClusterEventContentLoginReauthorizedAll types.ClusterEventContent = "loginReauthorizedAll"
	ClusterEventContentMailAccountsChanged  types.ClusterEventContent = "mailAccountsChanged"
	ClusterEventContentMailTemplatesChanged types.ClusterEventContent = "mailTemplatesChanged"
	ClusterEventContentMasterAssigned       types.ClusterEventContent = "masterAssigned"
	ClusterEventContentRenew                types.ClusterEventContent = "renew"
	ClusterEventContentReposChanged         types.ClusterEventContent = "reposChanged"
	ClusterEventContentSchemaChanged        types.ClusterEventContent = "schemaChanged"
	ClusterEventContentSchemaLoaded         types.ClusterEventContent = "schemaLoaded"
	ClusterEventContentSchemaLoading        types.ClusterEventContent = "schemaLoading"
	ClusterEventContentShutdownTriggered    types.ClusterEventContent = "shutdownTriggered"
	ClusterEventContentTasksChanged         types.ClusterEventContent = "tasksChanged"
	ClusterEventContentTaskTriggered        types.ClusterEventContent = "taskTriggered"
)
