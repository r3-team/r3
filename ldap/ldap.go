package ldap

import (
	"context"
	"r3/cluster"
	"r3/config/config_credential"
	"r3/login"
	"r3/login/login_metaMap"
	"r3/login/login_roleAssign"
	"r3/types"
	"r3/types/constants"

	"github.com/jackc/pgx/v5"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id int64) error {
	if err := login.DelByExternalProvider_tx(ctx, tx, constants.DbLoginProviderLdap, id); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM instance.ldap WHERE id = $1`, id); err != nil {
		return err
	}
	return cluster.LdapsChanged_tx(ctx, tx, true)
}

func Set_tx(ctx context.Context, tx pgx.Tx, l types.Ldap) (int64, error) {

	if l.Id == 0 {
		if err := tx.QueryRow(ctx, `
			INSERT INTO instance.ldap (
				login_template_id, name, host, port, bind_user_dn, search_class, search_dn,
				filter_dn_exclude, filter_dn_include, key_attribute, login_attribute,
				member_attribute, assign_roles, ms_ad_ext, starttls, tls, tls_verify,
				migrate_by_name
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
			RETURNING id
		`, l.LoginTemplateId, l.Name, l.Host, l.Port, l.BindUserDn, l.SearchClass, l.SearchDn,
			l.FilterDnExclude, l.FilterDnInclude, l.KeyAttribute, l.LoginAttribute, l.MemberAttribute,
			l.AssignRoles, l.MsAdExt, l.Starttls, l.Tls, l.TlsVerify, l.MigrateByName).Scan(&l.Id); err != nil {

			return 0, err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			UPDATE instance.ldap
			SET login_template_id = $1, name = $2, host = $3, port = $4, bind_user_dn = $5,
				search_class = $6, search_dn = $7, filter_dn_exclude = $8, filter_dn_include = $9,
				key_attribute = $10, login_attribute = $11, member_attribute = $12, assign_roles = $13,
				ms_ad_ext = $14, starttls = $15, tls = $16, tls_verify = $17, migrate_by_name = $18
			WHERE id = $19
		`, l.LoginTemplateId, l.Name, l.Host, l.Port, l.BindUserDn, l.SearchClass, l.SearchDn,
			l.FilterDnExclude, l.FilterDnInclude, l.KeyAttribute, l.LoginAttribute, l.MemberAttribute,
			l.AssignRoles, l.MsAdExt, l.Starttls, l.Tls, l.TlsVerify, l.MigrateByName, l.Id); err != nil {

			return 0, err
		}
	}
	if err := login_metaMap.Set_tx(ctx, tx, constants.DbLoginProviderLdap, l.Id, l.LoginMetaMap); err != nil {
		return 0, err
	}
	if err := login_roleAssign.Set_tx(ctx, tx, constants.DbLoginProviderLdap, l.Id, l.LoginRolesAssign); err != nil {
		return 0, err
	}
	return l.Id, cluster.LdapsChanged_tx(ctx, tx, true)
}

func SetBindUserPw_tx(ctx context.Context, tx pgx.Tx, id int64, bindUserPw string) error {
	if err := config_credential.SetInt_tx(ctx, tx, constants.CredentialsTargetLdap, id, bindUserPw); err != nil {
		return err
	}
	return cluster.LdapsChanged_tx(ctx, tx, true)
}
