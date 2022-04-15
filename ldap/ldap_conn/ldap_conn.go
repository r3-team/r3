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

	// prepare bind string
	protocol := "ldap"
	if ldap.Tls {
		protocol = "ldaps"
	}
	bind := fmt.Sprintf("%s://%s:%d", protocol, ldap.Host, ldap.Port)

	// prepare TLS config
	tlsConfig := tls.Config{
		InsecureSkipVerify: !ldap.TlsVerify,
		ServerName:         ldap.Host,
	}

	log.Info("ldap", fmt.Sprintf("connecting to '%s'", bind))

	var ldapConn *goldap.Conn
	if ldap.Tls {
		ldapConn, err = goldap.DialURL(bind, goldap.DialWithTLSConfig(&tlsConfig))
		if err != nil {
			return nil, ldap, err
		}
	} else {
		ldapConn, err = goldap.DialURL(bind)
		if err != nil {
			return nil, ldap, err
		}
		if ldap.Starttls {
			if err := ldapConn.StartTLS(&tlsConfig); err != nil {
				return nil, ldap, err
			}
		}
	}

	// bind with reading user
	if err := ldapConn.Bind(ldap.BindUserDn, ldap.BindUserPw); err != nil {
		return nil, ldap, err
	}
	return ldapConn, ldap, nil
}
