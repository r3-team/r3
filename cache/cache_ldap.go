package cache

import (
	"context"
	"fmt"
	"r3/cache/cache_credential"
	"r3/login/login_roleAssign"
	"r3/types"
	"r3/types/constants"
	"sync"

	"github.com/jackc/pgx/v5"
)

var (
	ldap_mx   sync.RWMutex
	ldapIdMap map[int64]types.Ldap
)

func GetLdapIdMap() map[int64]types.Ldap {
	ldap_mx.RLock()
	defer ldap_mx.RUnlock()
	return ldapIdMap
}

func GetLdap(id int64) (types.Ldap, error) {
	ldap_mx.RLock()
	defer ldap_mx.RUnlock()

	ldap, exists := ldapIdMap[id]
	if !exists {
		return ldap, fmt.Errorf("unknown LDAP connection ID %d", id)
	}
	return ldap, nil
}

func LoadLdapMap_tx(ctx context.Context, tx pgx.Tx) error {
	ldap_mx.Lock()
	defer ldap_mx.Unlock()

	ldapIdMap = make(map[int64]types.Ldap)
	cache_credential.ResetLdap()

	rows, err := tx.Query(ctx, `
		SELECT
			l.id, l.login_template_id, l.name, l.host, l.port, l.bind_user_dn, l.search_class, l.search_dn,
			l.filter_dn_exclude, l.filter_dn_include, l.key_attribute, l.login_attribute, l.member_attribute,
			l.assign_roles, l.ms_ad_ext, l.starttls, l.tls, l.tls_verify, l.migrate_by_name,
			COALESCE(m.department, ''), COALESCE(m.email, ''),
			COALESCE(m.location, ''), COALESCE(m.name_display, ''),
			COALESCE(m.name_fore, ''), COALESCE(m.name_sur, ''),
			COALESCE(m.notes, ''), COALESCE(m.organization, ''),
			COALESCE(m.phone_fax, ''), COALESCE(m.phone_landline, ''),
			COALESCE(m.phone_mobile, '')
		FROM      instance.ldap           AS l
		LEFT JOIN instance.login_meta_map AS m ON m.ldap_id = l.id
		ORDER BY l.name ASC
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var l types.Ldap
		var m types.LoginMeta
		if err := rows.Scan(&l.Id, &l.LoginTemplateId, &l.Name, &l.Host, &l.Port, &l.BindUserDn,
			&l.SearchClass, &l.SearchDn, &l.FilterDnExclude, &l.FilterDnInclude, &l.KeyAttribute,
			&l.LoginAttribute, &l.MemberAttribute, &l.AssignRoles, &l.MsAdExt, &l.Starttls, &l.Tls,
			&l.TlsVerify, &l.MigrateByName, &m.Department, &m.Email, &m.Location, &m.NameDisplay,
			&m.NameFore, &m.NameSur, &m.Notes, &m.Organization, &m.PhoneFax, &m.PhoneLandline,
			&m.PhoneMobile); err != nil {

			return err
		}

		if l.FilterDnExclude == nil {
			l.FilterDnExclude = make([]string, 0)
		}
		if l.FilterDnInclude == nil {
			l.FilterDnInclude = make([]string, 0)
		}
		l.LoginMetaMap = m

		ldapIdMap[l.Id] = l
	}
	rows.Close()

	for id, l := range ldapIdMap {
		l.LoginRolesAssign, err = login_roleAssign.Get_tx(ctx, tx, constants.DbLoginProviderLdap, id)
		if err != nil {
			return err
		}
		ldapIdMap[id] = l
	}
	return nil
}
