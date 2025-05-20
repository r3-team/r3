package ldap_auth

import (
	"errors"
	"fmt"
	"r3/ldap/ldap_conn"
	"r3/log"

	goldap "github.com/go-ldap/ldap/v3"
)

// authenticate against LDAP profile
func Check(ldapId int32, username string, password string) error {

	ldapConn, ldap, err := ldap_conn.ConnectAndBind(ldapId)
	if err != nil {
		log.Error(log.ContextLdap, "failed to connect or bind", err)
		return err
	}
	defer ldapConn.Close()

	// lookup given username
	search, err := ldapConn.Search(goldap.NewSearchRequest(
		ldap.SearchDn,
		goldap.ScopeWholeSubtree, goldap.NeverDerefAliases, 0, 0, false,
		fmt.Sprintf("(&(objectClass=%s)(%s=%s))", ldap.SearchClass,
			ldap.LoginAttribute, username),
		[]string{"dn"},
		nil,
	))

	if err != nil {
		log.Error(log.ContextLdap, "failed to execute search", err)
		return err
	}

	if len(search.Entries) != 1 {
		err := errors.New("zero or more than one user returned")
		log.Error(log.ContextLdap, "failed to execute search", err)
		return err
	}

	// authenticate user by attempting bind with their credentials
	if err := ldapConn.Bind(search.Entries[0].DN, password); err != nil {
		log.Info(log.ContextLdap, fmt.Sprintf("authentication for login '%s' failed", username))
		return err
	}

	log.Info(log.ContextLdap, fmt.Sprintf("authentication for login '%s' successful", username))
	return nil
}
