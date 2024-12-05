package login

import (
	"errors"
	"fmt"
	"math/rand"
	"r3/cache"
	"r3/db"
	"r3/handler"
	"r3/log"
	"r3/login/login_meta"
	"r3/login/login_setting"
	"r3/schema"
	"r3/tools"
	"r3/types"
	"slices"
	"strconv"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// delete one login
func Del_tx(tx pgx.Tx, id int64) error {
	// sync deletion before deleting the record as record meta data must be retrieved one last time
	syncLogin_tx(tx, "DELETED", id)

	_, err := tx.Exec(db.Ctx, `DELETE FROM instance.login WHERE id = $1`, id)
	return err
}

// get logins with meta data and total count
func Get(byId int64, byString string, orderBy string, orderAsc bool, limit int, offset int,
	meta bool, roles bool, recordRequests []types.LoginAdminRecordGet) ([]types.LoginAdmin, int, error) {

	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	logins := make([]types.LoginAdmin, 0)

	var qb tools.QueryBuilder
	qb.UseDollarSigns()
	qb.AddList("SELECT", []string{"l.id", "l.ldap_id", "l.ldap_key", "l.name",
		"l.admin", "l.limited", "l.no_auth", "l.active", "l.token_expiry_hours"})

	qb.SetFrom("instance.login AS l")

	// resolve requests for login records (records connected to logins via login attribute)
	parts := make([]string, 0)
	separator := "<|-|>"

	for _, r := range recordRequests {
		atrLogin, exists := cache.AttributeIdMap[r.AttributeIdLogin]
		if !exists {
			return logins, 0, fmt.Errorf("cannot find attribute for ID %s", r.AttributeIdLogin)
		}
		atrLookup, exists := cache.AttributeIdMap[r.AttributeIdLookup]
		if !exists {
			return logins, 0, fmt.Errorf("cannot find attribute for ID %s", r.AttributeIdLookup)
		}

		// if attribute exists, everything else does too
		rel := cache.RelationIdMap[atrLogin.RelationId]
		mod := cache.ModuleIdMap[rel.ModuleId]

		parts = append(parts, fmt.Sprintf(`SELECT COALESCE((SELECT CONCAT("%s",'%s',"%s") FROM "%s"."%s" WHERE "%s" = l.id),'')`,
			schema.PkName, separator, atrLookup.Name, mod.Name, rel.Name, atrLogin.Name))
	}
	if len(parts) != 0 {
		qb.Add("SELECT", fmt.Sprintf("ARRAY(%s)", strings.Join(parts, "\nUNION ALL\n")))
	} else {
		qb.Add("SELECT", "NULL")
	}

	// prepare filters
	if byString != "" {
		qb.Add("WHERE", `l.name ILIKE {NAME}`)
		qb.AddPara("{NAME}", fmt.Sprintf("%%%s%%", byString))
	} else if byId != 0 {
		qb.Add("WHERE", `l.id = {ID}`)
		qb.AddPara("{ID}", byId)
	}

	// prepare order, limit and offset
	if byId == 0 {
		var orderAscSql = "ASC"
		if !orderAsc {
			orderAscSql = "DESC"
		}
		switch orderBy {
		case "admin":
			qb.Add("ORDER", fmt.Sprintf("l.admin %s, l.name ASC", orderAscSql))
		case "ldap":
			qb.Add("ORDER", fmt.Sprintf("l.ldap_id %s, l.name ASC", orderAscSql))
		case "noAuth":
			qb.Add("ORDER", fmt.Sprintf("l.no_auth %s, l.name ASC", orderAscSql))
		case "limited":
			qb.Add("ORDER", fmt.Sprintf("l.limited %s, l.name ASC", orderAscSql))
		case "active":
			qb.Add("ORDER", fmt.Sprintf("l.active %s, l.name ASC", orderAscSql))
		default:
			qb.Add("ORDER", fmt.Sprintf("l.name %s", orderAscSql))
		}

		qb.SetLimit(limit)
		qb.SetOffset(offset)
	}

	query, err := qb.GetQuery()
	if err != nil {
		return logins, 0, err
	}

	rows, err := db.Pool.Query(db.Ctx, query, qb.GetParaValues()...)
	if err != nil {
		return logins, 0, err
	}

	for rows.Next() {
		var l types.LoginAdmin
		var records []string

		if err := rows.Scan(&l.Id, &l.LdapId, &l.LdapKey, &l.Name, &l.Admin, &l.Limited,
			&l.NoAuth, &l.Active, &l.TokenExpiryHours, &records); err != nil {

			return logins, 0, err
		}

		// process looked up login records
		l.Records = make([]types.LoginAdminRecord, 0)
		for _, r := range records {
			if r == "" {
				l.Records = append(l.Records, types.LoginAdminRecord{Id: pgtype.Int8{}, Label: ""})
				continue
			}

			parts = strings.Split(r, separator)
			if len(parts) != 2 {
				return logins, 0, errors.New("failed to separate login record ID from lookup attribute value")
			}

			id, err := strconv.ParseInt(parts[0], 10, 64)
			if err != nil {
				return logins, 0, err
			}
			l.Records = append(l.Records, types.LoginAdminRecord{
				Id:    pgtype.Int8{Int64: id, Valid: true},
				Label: parts[1],
			})
		}
		logins = append(logins, l)
	}
	rows.Close()

	// collect meta data
	if meta {
		for i, l := range logins {
			logins[i].Meta, err = login_meta.Get(l.Id)
			if err != nil {
				return logins, 0, err
			}
		}
	}

	// collect role IDs
	if roles {
		for i, l := range logins {
			logins[i].RoleIds, err = getRoleIds(l.Id)
			if err != nil {
				return logins, 0, err
			}
		}
	}

	// return single login if requested
	if byId != 0 {
		return logins, 1, nil
	}

	// get total count
	var qb_cnt tools.QueryBuilder
	qb_cnt.UseDollarSigns()
	qb_cnt.AddList("SELECT", []string{"COUNT(*)"})
	qb_cnt.SetFrom("instance.login")

	if byString != "" {
		qb_cnt.Add("WHERE", `name ILIKE {NAME}`)
		qb_cnt.AddPara("{NAME}", fmt.Sprintf("%%%s%%", byString))
	}

	query_cnt, err := qb_cnt.GetQuery()
	if err != nil {
		return logins, 0, err
	}

	var total int
	if err := db.Pool.QueryRow(db.Ctx, query_cnt, qb_cnt.GetParaValues()...).Scan(&total); err != nil {
		return logins, 0, err
	}
	return logins, total, nil
}

// set login with meta data
// returns created login ID if new login
func Set_tx(tx pgx.Tx, id int64, loginTemplateId pgtype.Int8, ldapId pgtype.Int4,
	ldapKey pgtype.Text, name string, pass string, admin bool, noAuth bool,
	active bool, tokenExpiryHours pgtype.Int4, meta types.LoginMeta, roleIds []uuid.UUID,
	records []types.LoginAdminRecordSet) (int64, error) {

	if name == "" {
		return 0, errors.New("name must not be empty")
	}

	name = strings.ToLower(name)                       // usernames are case insensitive
	isNew := id == 0                                   // ID 0 is new login
	isLimited := len(roleIds) < 2 && !admin && !noAuth // limited logins have at most 1 role, cannot be admin or without authentication

	if !isNew {
		// check for existing login
		var temp string
		err := tx.QueryRow(db.Ctx, `SELECT name FROM instance.login WHERE id = $1`, id).Scan(&temp)
		if err == pgx.ErrNoRows {
			return 0, fmt.Errorf("no login with ID %d", id)
		}
		if err != nil {
			return 0, err
		}
	}

	// generate password hash, if password was provided
	salt, hash := GenerateSaltHash(pass)
	saltKdf := tools.RandStringRunes(16)

	if isNew {
		if err := tx.QueryRow(db.Ctx, `
			INSERT INTO instance.login (
				ldap_id, ldap_key, name, salt, hash, salt_kdf,
				admin, no_auth, limited, active, token_expiry_hours
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
			RETURNING id
		`, ldapId, ldapKey, name, &salt, &hash, saltKdf, admin, noAuth,
			isLimited, active, tokenExpiryHours).Scan(&id); err != nil {

			return 0, err
		}

		// apply default login settings from login template
		if !loginTemplateId.Valid {
			// get GLOBAL template
			if err := tx.QueryRow(db.Ctx, `
				SELECT id
				FROM instance.login_template
				WHERE name = 'GLOBAL'
			`).Scan(&loginTemplateId); err != nil {
				return 0, err
			}
		}
		s, err := login_setting.Get(pgtype.Int8{}, loginTemplateId)
		if err != nil {
			return 0, err
		}
		if err := login_setting.Set_tx(tx, pgtype.Int8{Int64: id, Valid: true}, pgtype.Int8{}, s, true); err != nil {
			return 0, err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE instance.login
			SET ldap_id = $1, ldap_key = $2, name = $3, admin = $4,
				no_auth = $5, limited = $6, active = $7, token_expiry_hours = $8
			WHERE id = $9
		`, ldapId, ldapKey, name, admin, noAuth, isLimited, active, tokenExpiryHours, id); err != nil {
			return 0, err
		}

		if pass != "" {
			if err := SetSaltHash_tx(tx, salt, hash, id); err != nil {
				return 0, err
			}
		}
	}

	// set meta data
	if err := login_meta.Set_tx(tx, id, meta); err != nil {
		return 0, err
	}

	// execute login sync
	syncLogin_tx(tx, "UPDATED", id)

	// set records
	for _, record := range records {

		atr, exists := cache.AttributeIdMap[record.AttributeId]
		if !exists {
			return 0, handler.ErrSchemaUnknownAttribute(record.AttributeId)
		}
		rel := cache.RelationIdMap[atr.RelationId]
		mod := cache.ModuleIdMap[rel.ModuleId]
		if !isNew {
			// remove old record (first to free up unique index)
			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
				UPDATE "%s"."%s"
				SET "%s" = null
				WHERE "%s" = $1
			`, mod.Name, rel.Name, atr.Name, atr.Name), id); err != nil {
				return 0, err
			}
		}

		// set new record
		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
			UPDATE "%s"."%s"
			SET "%s" = $1
			WHERE "%s" = $2
		`, mod.Name, rel.Name, atr.Name, schema.PkName), id, record.RecordId); err != nil {
			return 0, err
		}
	}

	// set roles
	return id, setRoleIds_tx(tx, id, roleIds)
}

func SetSaltHash_tx(tx pgx.Tx, salt pgtype.Text, hash pgtype.Text, id int64) error {
	_, err := tx.Exec(db.Ctx, `
		UPDATE instance.login
		SET salt = $1, hash = $2
		WHERE id = $3
	`, &salt, &hash, id)

	return err
}

// get login to role memberships
func GetByRole(roleId uuid.UUID) ([]types.Login, error) {
	logins := make([]types.Login, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, name
		FROM instance.login
		WHERE active
		AND id IN (
			SELECT login_id
			FROM instance.login_role
			WHERE role_id = $1
		)
		ORDER BY name ASC
	`, roleId)
	if err != nil {
		return logins, err
	}
	defer rows.Close()

	for rows.Next() {
		var l types.Login
		if err := rows.Scan(&l.Id, &l.Name); err != nil {
			return logins, err
		}
		logins = append(logins, l)
	}
	return logins, nil
}

// get names for public lookups for non-admins
// returns slice of up to 10 logins
func GetNames(id int64, idsExclude []int64, byString string, noLdapAssign bool) ([]types.Login, error) {
	names := make([]types.Login, 0)

	var qb tools.QueryBuilder
	qb.UseDollarSigns()
	qb.AddList("SELECT", []string{"id", "name"})

	qb.SetFrom("instance.login")

	if id != 0 {
		qb.Add("WHERE", `id = {ID}`)
		qb.AddPara("{ID}", id)
	}

	if len(idsExclude) != 0 {
		qb.Add("WHERE", `id <> ALL({IDS_EXCLUDE})`)
		qb.AddPara("{IDS_EXCLUDE}", idsExclude)
	}

	if byString != "" {
		qb.Add("WHERE", `name ILIKE {NAME}`)
		qb.AddPara("{NAME}", fmt.Sprintf("%%%s%%", byString))
	}

	if noLdapAssign {
		qb.Add("WHERE", `(
			ldap_id IS NULL OR
			ldap_id NOT IN (
				SELECT id
				FROM instance.ldap
				WHERE assign_roles = true
			)
		)`)
	}

	qb.Add("ORDER", "name ASC")
	qb.SetLimit(10)

	query, err := qb.GetQuery()
	if err != nil {
		return names, err
	}

	rows, err := db.Pool.Query(db.Ctx, query, qb.GetParaValues()...)
	if err != nil {
		return names, err
	}
	defer rows.Close()

	for rows.Next() {
		var name types.Login
		if err := rows.Scan(&name.Id, &name.Name); err != nil {
			return names, err
		}
		names = append(names, name)
	}
	return names, nil
}

// user creatable fixed (permanent) tokens for less sensitive access permissions
func DelTokenFixed(loginId int64, id int64) error {
	_, err := db.Pool.Exec(db.Ctx, `
		DELETE FROM instance.login_token_fixed
		WHERE login_id = $1
		AND   id       = $2
	`, loginId, id)
	return err
}
func GetTokensFixed(loginId int64) ([]types.LoginTokenFixed, error) {
	tokens := make([]types.LoginTokenFixed, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, name, context, token, date_create
		FROM instance.login_token_fixed
		WHERE login_id = $1
		ORDER BY date_create ASC
	`, loginId)
	if err != nil {
		return tokens, err
	}
	defer rows.Close()

	for rows.Next() {
		var t types.LoginTokenFixed
		var n pgtype.Text
		if err := rows.Scan(&t.Id, &n, &t.Context, &t.Token, &t.DateCreate); err != nil {
			return tokens, err
		}
		t.Name = n.String
		tokens = append(tokens, t)
	}
	return tokens, nil
}
func SetTokenFixed_tx(tx pgx.Tx, loginId int64, name string, context string) (string, error) {
	min, max := 32, 48
	tokenFixed := tools.RandStringRunes(rand.Intn(max-min+1) + min)

	if _, err := tx.Exec(db.Ctx, `
		INSERT INTO instance.login_token_fixed (login_id,token,name,context,date_create)
			VALUES ($1,$2,$3,$4,$5)
	`, loginId, tokenFixed, name, context, tools.GetTimeUnix()); err != nil {
		return "", err
	}
	return tokenFixed, nil
}

// create new admin user
func CreateAdmin(username string, password string) error {

	ctx := db.GetCtxTimeoutSysTask()
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := Set_tx(tx, 0, pgtype.Int8{}, pgtype.Int4{}, pgtype.Text{},
		username, password, true, false, true, pgtype.Int4{},
		types.LoginMeta{NameFore: "Admin", NameSur: "User", NameDisplay: username},
		[]uuid.UUID{}, []types.LoginAdminRecordSet{}); err != nil {

		return err
	}
	return tx.Commit(ctx)
}

// reset all TOTP keys
func ResetTotp_tx(tx pgx.Tx, loginId int64) error {
	_, err := db.Pool.Exec(db.Ctx, `
		DELETE FROM instance.login_token_fixed
		WHERE login_id = $1
		AND   context  = 'totp'
	`, loginId)
	return err
}

func GenerateSaltHash(pw string) (salt pgtype.Text, hash pgtype.Text) {
	if pw != "" {
		salt.String = tools.RandStringRunes(32)
		salt.Valid = true
		hash.String = tools.Hash(salt.String + pw)
		hash.Valid = true
	}
	return salt, hash
}

// call login sync function for every module that has one to inform about changed login meta data
func syncLogin_tx(tx pgx.Tx, action string, id int64) {
	logContext := "server"
	logErr := "failed to execute user sync"

	if !slices.Contains([]string{"DELETED", "UPDATED"}, action) {
		log.Error(logContext, logErr, fmt.Errorf("unknown action '%s'", action))
		return
	}

	cache.Schema_mx.RLock()
	for _, mod := range cache.ModuleIdMap {
		if !mod.PgFunctionIdLoginSync.Valid {
			continue
		}

		fnc, exists := cache.PgFunctionIdMap[mod.PgFunctionIdLoginSync.Bytes]
		if !exists {
			continue
		}

		if _, err := tx.Exec(db.Ctx, `SELECT instance.user_sync($1,$2,$3,$4)`, mod.Name, fnc.Name, id, action); err != nil {
			log.Error(logContext, logErr, err)
		}
	}
	cache.Schema_mx.RUnlock()
}
