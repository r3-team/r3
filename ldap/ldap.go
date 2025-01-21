package ldap

import (
	"context"
	"r3/cache"
	"r3/db"
	"r3/login"
	"r3/types"
	"strings"

	"github.com/jackc/pgx/v5"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id int32) error {

	if err := login.DelByLdap_tx(ctx, tx, id); err != nil {
		return err
	}

	_, err := tx.Exec(ctx, `
		DELETE FROM instance.ldap
		WHERE id = $1
	`, id)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx) ([]types.Ldap, error) {
	ldaps := make([]types.Ldap, 0)

	rows, err := db.Pool.Query(ctx, `
		SELECT
			l.id,
			l.login_template_id,
			l.name,
			l.host,
			l.port,
			l.bind_user_dn,
			l.bind_user_pw,
			l.search_class,
			l.search_dn,
			l.key_attribute,
			l.login_attribute,
			l.member_attribute,
			l.assign_roles,
			l.ms_ad_ext,
			l.starttls,
			l.tls,
			l.tls_verify,
			COALESCE(m.department, ''),
			COALESCE(m.email, ''),
			COALESCE(m.location, ''),
			COALESCE(m.name_display, ''),
			COALESCE(m.name_fore, ''),
			COALESCE(m.name_sur, ''),
			COALESCE(m.notes, ''),
			COALESCE(m.organization, ''),
			COALESCE(m.phone_fax, ''),
			COALESCE(m.phone_landline, ''),
			COALESCE(m.phone_mobile, '')
		FROM      instance.ldap                      AS l
		LEFT JOIN instance.ldap_attribute_login_meta AS m ON m.ldap_id = l.id
		ORDER BY l.name ASC
	`)
	if err != nil {
		return ldaps, err
	}
	defer rows.Close()

	for rows.Next() {
		var l types.Ldap
		var m types.LoginMeta
		if err := rows.Scan(&l.Id, &l.LoginTemplateId, &l.Name, &l.Host,
			&l.Port, &l.BindUserDn, &l.BindUserPw, &l.SearchClass, &l.SearchDn,
			&l.KeyAttribute, &l.LoginAttribute, &l.MemberAttribute,
			&l.AssignRoles, &l.MsAdExt, &l.Starttls, &l.Tls, &l.TlsVerify,
			&m.Department, &m.Email, &m.Location, &m.NameDisplay, &m.NameFore,
			&m.NameSur, &m.Notes, &m.Organization, &m.PhoneFax, &m.PhoneLandline,
			&m.PhoneMobile); err != nil {

			return ldaps, err
		}
		l.LoginMetaAttributes = m
		ldaps = append(ldaps, l)
	}

	for i, _ := range ldaps {
		ldaps[i].Roles, err = getRoles(ctx, tx, ldaps[i].Id)
		if err != nil {
			return ldaps, err
		}
	}
	return ldaps, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, l types.Ldap) error {

	if l.Id == 0 {
		if err := tx.QueryRow(ctx, `
			INSERT INTO instance.ldap (
				login_template_id, name, host, port, bind_user_dn, bind_user_pw,
				search_class, search_dn, key_attribute, login_attribute,
				member_attribute, assign_roles, ms_ad_ext, starttls, tls, tls_verify
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
			RETURNING id
		`, l.LoginTemplateId, l.Name, l.Host, l.Port, l.BindUserDn, l.BindUserPw,
			l.SearchClass, l.SearchDn, l.KeyAttribute, l.LoginAttribute,
			l.MemberAttribute, l.AssignRoles, l.MsAdExt, l.Starttls, l.Tls,
			l.TlsVerify).Scan(&l.Id); err != nil {

			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			UPDATE instance.ldap
			SET login_template_id = $1, name = $2, host = $3, port = $4,
				bind_user_dn = $5, bind_user_pw = $6, search_class = $7,
				search_dn = $8, key_attribute = $9, login_attribute = $10,
				member_attribute = $11, assign_roles = $12, ms_ad_ext = $13,
				starttls = $14, tls = $15, tls_verify = $16
			WHERE id = $17
		`, l.LoginTemplateId, l.Name, l.Host, l.Port, l.BindUserDn, l.BindUserPw,
			l.SearchClass, l.SearchDn, l.KeyAttribute, l.LoginAttribute,
			l.MemberAttribute, l.AssignRoles, l.MsAdExt, l.Starttls, l.Tls,
			l.TlsVerify, l.Id); err != nil {

			return err
		}
	}

	if err := setLoginMetaAttributes_tx(ctx, tx, l.Id, l.LoginMetaAttributes); err != nil {
		return err
	}

	// update LDAP role assignment
	if _, err := tx.Exec(ctx, `
		DELETE FROM instance.ldap_role
		WHERE ldap_id = $1
	`, l.Id); err != nil {
		return err
	}

	for _, role := range l.Roles {
		if _, err := tx.Exec(ctx, `
			INSERT INTO instance.ldap_role (ldap_id, role_id, group_dn)
			VALUES ($1,$2,$3)
		`, l.Id, role.RoleId, role.GroupDn); err != nil {
			return err
		}
	}
	return nil
}

func UpdateCache() error {
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Commit(ctx)

	ldaps, err := Get_tx(ctx, tx)
	if err != nil {
		return err
	}

	cache.SetLdaps(ldaps)
	return nil
}

func setLoginMetaAttributes_tx(ctx context.Context, tx pgx.Tx, ldapId int32, m types.LoginMeta) error {
	var exists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT ldap_id
			FROM instance.ldap_attribute_login_meta
			WHERE ldap_id = $1
		)
	`, ldapId).Scan(&exists); err != nil {
		return err
	}

	// trim whitespaces from attributes
	m.Department = strings.TrimSpace(m.Department)
	m.Email = strings.TrimSpace(m.Email)
	m.Location = strings.TrimSpace(m.Location)
	m.NameDisplay = strings.TrimSpace(m.NameDisplay)
	m.NameFore = strings.TrimSpace(m.NameFore)
	m.NameSur = strings.TrimSpace(m.NameSur)
	m.Notes = strings.TrimSpace(m.Notes)
	m.Organization = strings.TrimSpace(m.Organization)
	m.PhoneFax = strings.TrimSpace(m.PhoneFax)
	m.PhoneLandline = strings.TrimSpace(m.PhoneLandline)
	m.PhoneMobile = strings.TrimSpace(m.PhoneMobile)

	var err error
	if !exists {
		_, err = tx.Exec(ctx, `
			INSERT INTO instance.ldap_attribute_login_meta (
				ldap_id, department, email, location, name_display,
				name_fore, name_sur, notes, organization, phone_fax,
				phone_landline, phone_mobile
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		`, ldapId, m.Department, m.Email, m.Location, m.NameDisplay,
			m.NameFore, m.NameSur, m.Notes, m.Organization, m.PhoneFax,
			m.PhoneLandline, m.PhoneMobile)
	} else {
		_, err = tx.Exec(ctx, `
			UPDATE instance.ldap_attribute_login_meta
			SET department = $1, email = $2, location = $3, name_display = $4,
				name_fore = $5, name_sur = $6, notes = $7, organization = $8,
				phone_fax = $9, phone_landline = $10, phone_mobile = $11
			WHERE ldap_id = $12
		`, m.Department, m.Email, m.Location, m.NameDisplay, m.NameFore,
			m.NameSur, m.Notes, m.Organization, m.PhoneFax, m.PhoneLandline,
			m.PhoneMobile, ldapId)
	}
	return err
}

func getRoles(ctx context.Context, tx pgx.Tx, ldapId int32) ([]types.LdapRole, error) {
	roles := make([]types.LdapRole, 0)

	rows, err := tx.Query(ctx, `
		SELECT role_id, group_dn
		FROM instance.ldap_role
		WHERE ldap_id = $1
		ORDER BY group_dn
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
