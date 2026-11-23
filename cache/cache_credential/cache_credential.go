package cache_credential

import (
	"fmt"
	"r3/config/config_credential"
	"r3/log"
	"r3/types"
	"r3/types/constants"
	"sync"

	"github.com/gofrs/uuid/v5"
)

type cred struct {
	password string // unencrypted password

	// stores retrieval error (nil if successful)
	// we store the error as retrieval does not need to be repeated, error will be the same
	// situation only changes if data is updated, after which reset() is called
	retrievalError error
}

var (
	access_mx sync.RWMutex

	// maps for credentials per target (ldap, oauth_client, mail_account, db_sync_host, repo, ...)
	// one map per different ID type for targets
	targetIdMapInt  = make(map[types.CredentialsTarget]map[int64]cred)
	targetIdMapUuid = make(map[types.CredentialsTarget]map[uuid.UUID]cred)
)

func init() {
	targetIdMapInt[constants.CredentialsTargetLdap] = make(map[int64]cred)
	targetIdMapInt[constants.CredentialsTargetMailAccount] = make(map[int64]cred)
	targetIdMapInt[constants.CredentialsTargetOauthClient] = make(map[int64]cred)
	targetIdMapUuid[constants.CredentialsTargetDbSyncHost] = make(map[uuid.UUID]cred)
	targetIdMapUuid[constants.CredentialsTargetRepo] = make(map[uuid.UUID]cred)
}

func GetDbSyncHost(id uuid.UUID, logName string) (string, error) {
	return getByUuid(constants.CredentialsTargetDbSyncHost, id, logName)
}
func GetLdap(id int64, logName string) (string, error) {
	return getByInt(constants.CredentialsTargetLdap, id, logName)
}
func GetMailAccount(id int64, logName string) (string, error) {
	return getByInt(constants.CredentialsTargetMailAccount, id, logName)
}
func GetOauthClient(id int64, logName string) (string, error) {
	return getByInt(constants.CredentialsTargetOauthClient, id, logName)
}
func GetRepo(id uuid.UUID, logName string) (string, error) {
	return getByUuid(constants.CredentialsTargetRepo, id, logName)
}
func ResetDbSyncHosts() {
	resetForUuid(constants.CredentialsTargetDbSyncHost)
}
func ResetLdap() {
	resetForInt(constants.CredentialsTargetLdap)
}
func ResetMailAccounts() {
	resetForInt(constants.CredentialsTargetMailAccount)
}
func ResetOAuthClients() {
	resetForInt(constants.CredentialsTargetOauthClient)
}
func ResetRepo() {
	resetForUuid(constants.CredentialsTargetRepo)
}

// internal
func getByInt(target types.CredentialsTarget, id int64, logName string) (string, error) {
	access_mx.RLock()
	c, exists := targetIdMapInt[target][id]
	access_mx.RUnlock()

	if !exists {
		pw, err := config_credential.GetInt(target, id)
		if err != nil {
			log.Error(log.ContextServer, fmt.Sprintf("failed to retrieve credentials for target '%s' (%s)", target, logName), err)
		}

		// we continue in error case, retrieval error is stored in cache
		c = cred{password: pw, retrievalError: err}

		access_mx.Lock()
		targetIdMapInt[target][id] = c
		access_mx.Unlock()
	}
	return c.password, c.retrievalError
}
func getByUuid(target types.CredentialsTarget, id uuid.UUID, logName string) (string, error) {
	access_mx.RLock()
	c, exists := targetIdMapUuid[target][id]
	access_mx.RUnlock()

	if !exists {
		pw, err := config_credential.GetUuid(target, id)
		if err != nil {
			log.Error(log.ContextServer, fmt.Sprintf("failed to retrieve credentials for target '%s' (%s)", target, logName), err)
		}

		// we continue in error case, retrieval error is stored in cache
		c = cred{password: pw, retrievalError: err}

		access_mx.Lock()
		targetIdMapUuid[target][id] = c
		access_mx.Unlock()
	}
	return c.password, c.retrievalError
}
func resetForInt(target types.CredentialsTarget) {
	access_mx.Lock()
	defer access_mx.Unlock()

	targetIdMapInt[target] = make(map[int64]cred)
}
func resetForUuid(target types.CredentialsTarget) {
	access_mx.Lock()
	defer access_mx.Unlock()

	targetIdMapUuid[target] = make(map[uuid.UUID]cred)
}
