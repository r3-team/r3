package login

import (
	"context"
	"fmt"
	"r3/db"
	"r3/log"
	"r3/login/login_clusterEvent"
	"r3/login/login_meta"
	"r3/login/login_metaMap"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// updates internal login backend with logins from LDAP
// uses unique LDAP key value to update login record
func SetLdapLogin(ldap types.Ldap, ldapKey, name string, active bool, meta types.LoginMeta, roleIds []uuid.UUID) error {
	var loginId int64
	var loginMigrate bool
	var adminEx, activeEx bool
	var metaEx types.LoginMeta
	var nameEx string
	var roleIdsEx []uuid.UUID
	var rolesEqual pgtype.Bool

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// get login details and check whether roles could be updated
	err = tx.QueryRow(ctx, `
		SELECT r1.id, r1.name, r1.admin, r1.active,
			(
				r1.ldap_id  IS DISTINCT FROM $1::integer AND
				r1.ldap_key IS DISTINCT FROM $2::text    AND
				TRUE        = $3
			) AS login_migrate,
			r1.roles, (r1.roles <@ r2.roles AND r1.roles @> r2.roles) AS equal
		FROM (
			SELECT *, (
				SELECT ARRAY_AGG(lr.role_id)
				FROM instance.login_role AS lr
				WHERE lr.login_id = l.id
			) AS roles
			FROM instance.login AS l
			WHERE (
				-- known login for this LDAP connection
				l.ldap_id  = $1::integer AND
				l.ldap_key = $2::text
			)
			OR (
				-- migration option: login matched by username
				l.ldap_id  IS DISTINCT FROM $1::integer AND
				l.ldap_key IS DISTINCT FROM $2::text    AND
				TRUE       = $3 AND
				l.name     = $4
			)
			-- order by LDAP ID to get valid login first (edge case: both known LDAP and other login with same name exist)
			ORDER BY CASE WHEN l.ldap_id = $1 THEN 0 ELSE 1 END
			LIMIT 1
		) AS r1

		INNER JOIN (
			SELECT $5::uuid[] AS roles
		) AS r2 ON true
	`, ldap.Id, ldapKey, ldap.MigrateByName, name, roleIds).Scan(
		&loginId, &nameEx, &adminEx, &activeEx, &loginMigrate, &roleIdsEx, &rolesEqual)

	if err != nil && err != pgx.ErrNoRows {
		return err
	}

	newLogin := err == pgx.ErrNoRows
	rolesBothEmpty := len(roleIdsEx) == 0 && len(roleIds) == 0
	rolesChanged := ldap.AssignRoles && !rolesEqual.Bool && !rolesBothEmpty

	// apply changed meta data from LDAP attributes, if they are defined
	var metaChanged bool = false
	if newLogin {
		metaEx = meta
	} else {
		metaEx, err = login_meta.Get_tx(ctx, tx, loginId)
		if err != nil {
			return err
		}
		metaEx, metaChanged = login_metaMap.UpdateChangedMeta(ldap.LoginMetaMap, metaEx, meta)
	}

	// abort if no changes are there to apply
	if !newLogin && nameEx == name && activeEx == active && !rolesChanged && !metaChanged && !loginMigrate {
		return nil
	}

	ldapIdSql := pgtype.Int4{Int32: ldap.Id, Valid: true}
	ldapKeySql := pgtype.Text{String: ldapKey, Valid: true}
	if rolesChanged {
		roleIdsEx = roleIds
	}

	log.Info(log.ContextLdap, fmt.Sprintf("user account '%s' is new or has been changed, updating login", name))

	if _, err := Set_tx(ctx, tx, loginId, ldap.LoginTemplateId, ldapIdSql, ldapKeySql, pgtype.Int4{},
		pgtype.Text{}, pgtype.Text{}, name, "", adminEx, false, active, pgtype.Int4{}, pgtype.Bool{},
		metaEx, roleIdsEx, []types.LoginAdminRecordSet{}); err != nil {

		return err
	}

	if !newLogin && loginMigrate {
		log.Info(log.ContextLdap, fmt.Sprintf("migrating user '%s' to LDAP '%s'", name, ldap.Name))

		if err := MigrateProviderLdap_tx(ctx, tx, loginId, ldapIdSql, ldapKeySql); err != nil {
			return err
		}
	}
	if active && rolesChanged {
		login_clusterEvent.Reauth_tx(ctx, tx, loginId, name)
	}
	if !active && activeEx {
		login_clusterEvent.Kick_tx(ctx, tx, loginId, name)
	}
	return tx.Commit(ctx)
}
