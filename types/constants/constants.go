package constants

import "r3/types"

const (
	AccessDelete types.Access = 3
	AccessRead   types.Access = 1
	AccessWrite  types.Access = 2

	LoginTypeFixed  types.LoginType = "fixed"  // auth via fixed token, used for ICS & fat client
	LoginTypeLdap   types.LoginType = "ldap"   // auth via credentials, credentials managed in ext. directory
	LoginTypeLocal  types.LoginType = "local"  // auth via credentials, credentials managed in internal login backend
	LoginTypeNoAuth types.LoginType = "noAuth" // auth via login name (public user)
	LoginTypeOauth  types.LoginType = "oauth"  // auth via ext. provider (Open ID connect)

	MailTemplateContentLoginInvitation types.MailTemplateContent = "loginInvitation"
	MailTemplateContentLoginPwReset    types.MailTemplateContent = "loginPwReset"

	OauthFlowClientCredentials types.OauthFlow = "clientCreds"
	OauthFlowAuthCodePkce      types.OauthFlow = "authCodePkce"

	WebsocketClientDeviceBrowser   types.WebsocketClientDevice = 1
	WebsocketClientDeviceFatClient types.WebsocketClientDevice = 2
)

var (
	QueryJoinConnectors   = []string{"INNER", "LEFT", "RIGHT", "FULL", "CROSS"}
	QueryFilterConnectors = []string{"AND", "OR"}
	QueryFilterOperators  = []string{"=", "<>", "<", ">", "<=", ">=", "IS NULL",
		"IS NOT NULL", "LIKE", "ILIKE", "NOT LIKE", "NOT ILIKE", "= ANY",
		"<> ALL", "@>", "<@", "&&", "@@", "~", "~*", "!~", "!~*"}

	WebsocketClientDeviceNames = map[types.WebsocketClientDevice]types.DbSchemaInstanceLoginSessionDevice{
		WebsocketClientDeviceBrowser:   DbLoginSessionDeviceBrowser,
		WebsocketClientDeviceFatClient: DbLoginSessionDeviceFatClient,
	}
)
