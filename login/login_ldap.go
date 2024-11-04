package login

import (
	"fmt"
	"r3/cluster"
	"r3/db"
	"r3/log"
	"r3/login/login_meta"
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

	err := db.Pool.QueryRow(db.Ctx, `
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
		metaEx, err = login_meta.Get(loginId)
		if err != nil {
			return err
		}
		if ldap.LoginMetaAttributes.Department != "" && meta.Department != metaEx.Department {
			metaEx.Department = meta.Department
			metaChanged = true
		}
		if ldap.LoginMetaAttributes.Email != "" && meta.Email != metaEx.Email {
			metaEx.Email = meta.Email
			metaChanged = true
		}
		if ldap.LoginMetaAttributes.Location != "" && meta.Location != metaEx.Location {
			metaEx.Location = meta.Location
			metaChanged = true
		}
		if ldap.LoginMetaAttributes.NameDisplay != "" && meta.NameDisplay != metaEx.NameDisplay {
			metaEx.NameDisplay = meta.NameDisplay
			metaChanged = true
		}
		if ldap.LoginMetaAttributes.NameFore != "" && meta.NameFore != metaEx.NameFore {
			metaEx.NameFore = meta.NameFore
			metaChanged = true
		}
		if ldap.LoginMetaAttributes.NameSur != "" && meta.NameSur != metaEx.NameSur {
			metaEx.NameSur = meta.NameSur
			metaChanged = true
		}
		if ldap.LoginMetaAttributes.Notes != "" && meta.Notes != metaEx.Notes {
			metaEx.Notes = meta.Notes
			metaChanged = true
		}
		if ldap.LoginMetaAttributes.Organization != "" && meta.Organization != metaEx.Organization {
			metaEx.Organization = meta.Organization
			metaChanged = true
		}
		if ldap.LoginMetaAttributes.PhoneFax != "" && meta.PhoneFax != metaEx.PhoneFax {
			metaEx.PhoneFax = meta.PhoneFax
			metaChanged = true
		}
		if ldap.LoginMetaAttributes.PhoneLandline != "" && meta.PhoneLandline != metaEx.PhoneLandline {
			metaEx.PhoneLandline = meta.PhoneLandline
			metaChanged = true
		}
		if ldap.LoginMetaAttributes.PhoneMobile != "" && meta.PhoneMobile != metaEx.PhoneMobile {
			metaEx.PhoneMobile = meta.PhoneMobile
			metaChanged = true
		}
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

	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(db.Ctx)

	log.Info("ldap", fmt.Sprintf("user account '%s' is new or has been changed, updating login", name))

	if _, err := Set_tx(tx, loginId, ldap.LoginTemplateId, ldapIdSql, ldapKeySql, name, "",
		adminEx, false, active, pgtype.Int4{}, metaEx, roleIdsEx, []types.LoginAdminRecordSet{}); err != nil {

		return err
	}

	// commit before renewing access cache (to apply new permissions)
	if err := tx.Commit(db.Ctx); err != nil {
		return err
	}

	// roles needed to be changed for active login, reauthorize
	if active && rolesChanged {
		log.Info("ldap", fmt.Sprintf("user account '%s' received new roles, renewing access permissions", name))

		if err := cluster.LoginReauthorized(true, loginId); err != nil {
			log.Warning("ldap", fmt.Sprintf("could not renew access permissions for '%s'", name), err)
		}
	}

	// login was disabled, kick
	if !active && activeEx {
		log.Info("ldap", fmt.Sprintf("user account '%s' is locked, kicking active sessions", name))

		if err := cluster.LoginDisabled(true, loginId); err != nil {
			log.Warning("ldap", fmt.Sprintf("could not kick active sessions for '%s'", name), err)
		}
	}
	return nil
}
