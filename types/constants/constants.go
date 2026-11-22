package constants

import "r3/types"

const (
	AccessDelete types.Access = 3
	AccessRead   types.Access = 1
	AccessWrite  types.Access = 2

	AppVersionTargetClient types.AppVersionTarget = "client"
	AppVersionTargetSelf   types.AppVersionTarget = "self"

	CredentialsAlgorithmAesGcm   types.CredentialsAlgorithm = "aesGcm256"
	CredentialsSystemTokenSecret types.CredentialsSystem    = "tokenSecret"

	CredentialsTargetDbSyncHost  types.CredentialsTarget = "db_sync_host"
	CredentialsTargetLdap        types.CredentialsTarget = "ldap"
	CredentialsTargetMailAccount types.CredentialsTarget = "mail_account"
	CredentialsTargetOauthClient types.CredentialsTarget = "oauth_client"

	LoginMfaIntervalSec int64 = 30 // MFA interval window size (in seconds)

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
	CredentialSystemCreds = []types.CredentialsSystem{CredentialsSystemTokenSecret}

	CredentialTargetsIdInt  = []types.CredentialsTarget{CredentialsTargetLdap, CredentialsTargetMailAccount, CredentialsTargetOauthClient}
	CredentialTargetsIdUuid = []types.CredentialsTarget{CredentialsTargetDbSyncHost}

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
