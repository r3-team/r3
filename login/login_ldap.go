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

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// updates internal login backend with logins from LDAP
// uses unique key value to update login record
// can optionally update login roles
func SetLdapLogin(ldap types.Ldap, ldapKey string, name string,
	active bool, meta types.LoginMeta, roleIds []uuid.UUID) error {

	// existing login details
	var loginId int64
	var adminEx, activeEx bool
	var metaEx types.LoginMeta
	var nameEx string
	var roleIdsEx []uuid.UUID

	// get login details and check whether roles could be updated
	var rolesEqual pgtype.Bool

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx, `
		SELECT r1.id, r1.name, r1.admin, r1.active, r1.roles,
			(r1.roles <@ r2.roles AND r1.roles @> r2.roles) AS equal
		FROM (
			SELECT *, (
				SELECT ARRAY_AGG(lr.role_id)
				FROM instance.login_role AS lr
				WHERE lr.login_id = l.id
			) AS roles
			FROM instance.login AS l
			WHERE l.ldap_id  = $1::integer
			AND   l.ldap_key = $2::text
		) AS r1
		
		INNER JOIN (
			SELECT $3::uuid[] AS roles
		) AS r2 ON true
	`, ldap.Id, ldapKey, roleIds).Scan(&loginId, &nameEx,
		&adminEx, &activeEx, &roleIdsEx, &rolesEqual)

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
	if !newLogin && nameEx == name && activeEx == active && !rolesChanged && !metaChanged {
		return nil
	}

	// update if name, active state or roles changed
	ldapIdSql := pgtype.Int4{Int32: ldap.Id, Valid: true}
	ldapKeySql := pgtype.Text{String: ldapKey, Valid: true}

	if rolesChanged {
		roleIdsEx = roleIds
	}

	log.Info(log.ContextLdap, fmt.Sprintf("user account '%s' is new or has been changed, updating login", name))

	if _, err := Set_tx(ctx, tx, loginId, ldap.LoginTemplateId, ldapIdSql, ldapKeySql, pgtype.Int4{},
		pgtype.Text{}, pgtype.Text{}, name, "", adminEx, false, active, pgtype.Int4{}, metaEx, roleIdsEx,
		[]types.LoginAdminRecordSet{}); err != nil {

		return err
	}

	if active && rolesChanged {
		login_clusterEvent.Reauth_tx(ctx, tx, loginId, name)
	}
	if !active && activeEx {
		login_clusterEvent.Kick_tx(ctx, tx, loginId, name)
	}
	return tx.Commit(ctx)
}
