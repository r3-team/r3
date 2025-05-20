package login_external

import (
	"fmt"
	"slices"
)

const (
	EntityLdap        = "ldap"
	EntityOauthClient = "oauth_client"
)

func ValidateEntity(entity string) error {
	if !slices.Contains([]string{EntityLdap, EntityOauthClient}, entity) {
		return fmt.Errorf("invalid external login entity '%s'", entity)
	}
	return nil
}
