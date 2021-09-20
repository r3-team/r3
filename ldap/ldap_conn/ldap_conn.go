package ldap_conn

import (
	"crypto/tls"
	"fmt"
	"r3/cache"
	"r3/log"
	"r3/types"

	goldap "github.com/go-ldap/ldap/v3"
)

// connect to a LDAP profile
func ConnectAndBind(ldapId int32) (*goldap.Conn, types.Ldap, error) {

	ldap, err := cache.GetLdap(ldapId)
	if err != nil {
		return nil, ldap, err
	}

	bind := fmt.Sprintf("ldap://%s:%d", ldap.Host, ldap.Port)

	log.Info("ldap", fmt.Sprintf("connecting to %s (TLS: %v)", bind, ldap.Tls))

	ldapConn, err := goldap.DialURL(bind)
	if err != nil {
		return nil, ldap, err
	}

	// reconnect with TLS if requested
	if ldap.Tls {

		tlsConfig := tls.Config{}

		if !ldap.TlsVerify {
			tlsConfig.InsecureSkipVerify = true
		}
		if err := ldapConn.StartTLS(&tlsConfig); err != nil {
			return nil, ldap, err
		}
	}

	// bind with reading user
	if err := ldapConn.Bind(ldap.BindUserDn, ldap.BindUserPw); err != nil {
		return nil, ldap, err
	}
	return ldapConn, ldap, nil
}
