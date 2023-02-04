package ldap

import (
	"r3/db"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func Del_tx(tx pgx.Tx, id int32) error {

	_, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.ldap
		WHERE id = $1
	`, id)
	return err
}

func Get() ([]types.Ldap, error) {

	ldaps := make([]types.Ldap, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, name, host, port, bind_user_dn, bind_user_pw, search_class,
			search_dn, key_attribute, login_attribute, member_attribute,
			assign_roles, ms_ad_ext, starttls, tls, tls_verify
		FROM instance.ldap
		ORDER BY name ASC
	`)
	if err != nil {
		return ldaps, err
	}

	for rows.Next() {
		var l types.Ldap
		if err := rows.Scan(&l.Id, &l.Name, &l.Host, &l.Port, &l.BindUserDn,
			&l.BindUserPw, &l.SearchClass, &l.SearchDn, &l.KeyAttribute,
			&l.LoginAttribute, &l.MemberAttribute, &l.AssignRoles, &l.MsAdExt,
			&l.Starttls, &l.Tls, &l.TlsVerify); err != nil {

			rows.Close()
			return ldaps, err
		}
		ldaps = append(ldaps, l)
	}
	rows.Close()

	for i, _ := range ldaps {
		ldaps[i].Roles, err = getRoles(ldaps[i].Id)
		if err != nil {
			return ldaps, err
		}
	}
	return ldaps, nil
}

func Set_tx(tx pgx.Tx, id int32, name string, host string, port int,
	bindUserDn string, bindUserPw string, searchClass string, searchDn string,
	keyAttribute string, loginAttribute string, memberAttribute string,
	assignRoles bool, msAdExt bool, starttls bool, tls bool, tlsVerify bool,
	roles []types.LdapRole) error {

	if id == 0 {
		if err := tx.QueryRow(db.Ctx, `
			INSERT INTO instance.ldap (
				name, host, port, bind_user_dn, bind_user_pw, search_class,
				search_dn, key_attribute, login_attribute, member_attribute,
				assign_roles, ms_ad_ext, starttls, tls, tls_verify
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
			RETURNING id
		`, name, host, port, bindUserDn, bindUserPw, searchClass, searchDn,
			keyAttribute, loginAttribute, memberAttribute, assignRoles, msAdExt,
			starttls, tls, tlsVerify).Scan(&id); err != nil {

			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE instance.ldap
			SET name = $1, host = $2, port = $3, bind_user_dn = $4,
				bind_user_pw = $5, search_class = $6, search_dn = $7,
				key_attribute = $8, login_attribute = $9, member_attribute = $10,
				assign_roles = $11, ms_ad_ext = $12, starttls = $13, tls = $14,
				tls_verify = $15
			WHERE id = $16
		`, name, host, port, bindUserDn, bindUserPw, searchClass, searchDn,
			keyAttribute, loginAttribute, memberAttribute, assignRoles, msAdExt,
			starttls, tls, tlsVerify, id); err != nil {

			return err
		}
	}

	// update LDAP role assignment
	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.ldap_role
		WHERE ldap_id = $1
	`, id); err != nil {
		return err
	}

	for _, role := range roles {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO instance.ldap_role (ldap_id, role_id, group_dn)
			VALUES ($1,$2,$3)
		`, id, role.RoleId, role.GroupDn); err != nil {
			return err
		}
	}
	return nil
}

func getRoles(ldapId int32) ([]types.LdapRole, error) {

	roles := make([]types.LdapRole, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT role_id, group_dn
		FROM instance.ldap_role
		WHERE ldap_id = $1
	`, ldapId)
	if err != nil {
		return roles, err
	}
	defer rows.Close()

	for rows.Next() {
		var r types.LdapRole
		if err := rows.Scan(&r.RoleId, &r.GroupDn); err != nil {
			return roles, err
		}
		r.LdapId = ldapId
		roles = append(roles, r)
	}
	return roles, nil
}
