package ldap

import (
	"context"
	"r3/cache"
	"r3/login"
	"r3/login/login_external"
	"r3/login/login_metaMap"
	"r3/login/login_roleAssign"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id int32) error {

	if err := login.DelByExternalProvider_tx(ctx, tx, login_external.EntityLdap, id); err != nil {
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

	rows, err := tx.Query(ctx, `
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
		FROM      instance.ldap           AS l
		LEFT JOIN instance.login_meta_map AS m ON m.ldap_id = l.id
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
		l.LoginMetaMap = m
		ldaps = append(ldaps, l)
	}

	for i, _ := range ldaps {
		ldaps[i].LoginRolesAssign, err = login_roleAssign.Get_tx(ctx, tx, login_external.EntityLdap, ldaps[i].Id)
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

	if err := login_metaMap.Set_tx(ctx, tx, login_external.EntityLdap, l.Id, l.LoginMetaMap); err != nil {
		return err
	}
	if err := login_roleAssign.Set_tx(ctx, tx, login_external.EntityLdap, l.Id, l.LoginRolesAssign); err != nil {
		return err
	}
	return nil
}
func UpdateCache_tx(ctx context.Context, tx pgx.Tx) error {
	ldaps, err := Get_tx(ctx, tx)
	if err != nil {
		return err
	}
	cache.SetLdaps(ldaps)
	return nil
}
