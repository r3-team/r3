package login

import (
	"errors"
	"fmt"
	"math/rand"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/schema"
	"r3/setting"
	"r3/tools"
	"r3/types"
	"strconv"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// delete one login
func Del_tx(tx pgx.Tx, id int64) error {
	_, err := tx.Exec(db.Ctx, `DELETE FROM instance.login WHERE id = $1`, id)
	return err
}

// get logins with meta data and total count
func Get(byString string, limit int, offset int, recordRequests []types.LoginAdminRecordRequest) ([]types.LoginAdmin, int, error) {
	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	logins := make([]types.LoginAdmin, 0)

	var qb tools.QueryBuilder
	qb.UseDollarSigns()
	qb.AddList("SELECT", []string{"l.id", "l.ldap_id", "l.ldap_key", "l.name",
		"l.admin", "l.no_auth", "l.active", "ls.language_code"})

	qb.Set("FROM", "instance.login AS l")
	qb.Add("JOIN", "INNER JOIN instance.login_setting AS ls ON ls.login_id = l.id")

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
		rel, _ := cache.RelationIdMap[atrLogin.RelationId]
		mod, _ := cache.ModuleIdMap[rel.ModuleId]

		parts = append(parts, fmt.Sprintf(`SELECT COALESCE((SELECT CONCAT("%s",'%s',"%s") FROM "%s"."%s" WHERE "%s" = l.id),'')`,
			schema.PkName, separator, atrLookup.Name, mod.Name, rel.Name, atrLogin.Name))
	}
	if len(parts) != 0 {
		qb.Add("SELECT", fmt.Sprintf("ARRAY(%s)", strings.Join(parts, "\nUNION ALL\n")))
	} else {
		qb.Add("SELECT", "NULL")
	}

	if byString != "" {
		qb.Add("WHERE", `l.name ILIKE {NAME}`)
		qb.AddPara("{NAME}", fmt.Sprintf("%%%s%%", byString))
	}

	qb.Add("ORDER", "l.name ASC")
	qb.Set("LIMIT", limit)
	qb.Set("OFFSET", offset)

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

		if err := rows.Scan(&l.Id, &l.LdapId, &l.LdapKey, &l.Name, &l.Admin,
			&l.NoAuth, &l.Active, &l.LanguageCode, &records); err != nil {

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

	// collect role IDs
	for i, l := range logins {
		logins[i].RoleIds, err = getRoleIds(l.Id)
		if err != nil {
			return logins, 0, err
		}
	}

	// get total count
	var qb_cnt tools.QueryBuilder
	qb_cnt.UseDollarSigns()
	qb_cnt.AddList("SELECT", []string{"COUNT(*)"})
	qb_cnt.Set("FROM", "instance.login")

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
func Set_tx(tx pgx.Tx, id int64, ldapId pgtype.Int4, ldapKey pgtype.Text,
	languageCode string, name string, pass string, admin bool, noAuth bool,
	active bool, roleIds []uuid.UUID) error {

	if languageCode == "" {
		languageCode = config.GetString("defaultLanguageCode")
	}

	if name == "" {
		return errors.New("name must not be empty")
	}

	// usernames are case insensitive
	name = strings.ToLower(name)

	// check for existing login
	var exists bool
	if err := tx.QueryRow(db.Ctx, `
		SELECT EXISTS(
			SELECT name
			FROM instance.login
			WHERE id = $1
		)
	`, id).Scan(&exists); err != nil {
		return err
	}

	// generate password hash, if password was provided
	var salt, hash = pgtype.Text{}, pgtype.Text{}

	var saltKdf = tools.RandStringRunes(16)

	if pass != "" {
		salt.String = tools.RandStringRunes(32)
		salt.Valid = true

		hash.String = tools.Hash(salt.String + pass)
		hash.Valid = true
	}

	if !exists {
		if err := tx.QueryRow(db.Ctx, `
			INSERT INTO instance.login (
				ldap_id, ldap_key, name, salt, hash,
				salt_kdf, admin, no_auth, active
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
			RETURNING id
		`, ldapId, ldapKey, name, &salt, &hash, saltKdf,
			admin, noAuth, active).Scan(&id); err != nil {

			return err
		}
		if err := setting.SetDefaults_tx(tx, id, languageCode); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE instance.login
			SET ldap_id = $1, ldap_key = $2, name = $3, admin = $4,
				no_auth = $5, active = $6
			WHERE id = $7
		`, ldapId, ldapKey, name, admin, noAuth, active, id); err != nil {
			return err
		}
		if err := setting.SetLanguageCode_tx(tx, id, languageCode); err != nil {
			return err
		}

		if pass != "" {
			if _, err := tx.Exec(db.Ctx, `
				UPDATE instance.login
				SET salt = $1, hash = $2
				WHERE id = $3
			`, &salt, &hash, id); err != nil {
				return err
			}
		}
	}
	return setRoleIds_tx(tx, id, roleIds)
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

	qb.Set("FROM", "instance.login")

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
	qb.Set("LIMIT", 10)

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

	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(db.Ctx)

	if err := Set_tx(tx, 0, pgtype.Int4{}, pgtype.Text{}, "", username,
		password, true, false, true, []uuid.UUID{}); err != nil {

		return err
	}
	return tx.Commit(db.Ctx)
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

// updates internal login backend with logins from LDAP
// uses unique key value to update login record
// can optionally update login roles
// returns login ID and whether login needed to be changed
func SetLdapLogin_tx(tx pgx.Tx, ldapId int32, ldapKey string, ldapName string,
	ldapActive bool, ldapRoleIds []uuid.UUID, updateRoles bool) (int64, bool, error) {

	// existing login details
	var id int64
	var nameEx, languageCode string
	var roleIds []uuid.UUID
	var admin, active bool

	// get login details and check whether roles could be updated
	var rolesEqual pgtype.Bool

	err := tx.QueryRow(db.Ctx, `
		SELECT r1.id, r1.name, s.language_code, r1.admin, r1.active, r1.roles,
			(r1.roles <@ r2.roles AND r1.roles @> r2.roles) AS equal
		FROM (
			SELECT *, (
				SELECT ARRAY_AGG(lr.role_id)
				FROM instance.login_role AS lr
				WHERE lr.login_id = l.id
			) AS roles
			FROM instance.login AS l
			WHERE l.ldap_id = $1::integer
			AND l.ldap_key = $2::text
		) AS r1
		
		INNER JOIN instance.login_setting AS s
			ON s.login_id = r1.id
		
		INNER JOIN (
			SELECT $3::uuid[] AS roles
		) AS r2 ON true
	`, ldapId, ldapKey, ldapRoleIds).Scan(&id, &nameEx,
		&languageCode, &admin, &active, &roleIds, &rolesEqual)

	if err != nil && err != pgx.ErrNoRows {
		return 0, false, err
	}

	// create if new
	// update if name, active state or roles changed
	newLogin := err == pgx.ErrNoRows
	rolesNeedUpdate := updateRoles && !rolesEqual.Bool

	if newLogin || nameEx != ldapName || active != ldapActive || rolesNeedUpdate {

		ldapIdSql := pgtype.Int4{Int32: ldapId, Valid: true}
		ldapKeySql := pgtype.Text{String: ldapKey, Valid: true}

		if rolesNeedUpdate {
			roleIds = ldapRoleIds
		}
		if newLogin {
			active = true
		}
		return id, true, Set_tx(tx, id, ldapIdSql, ldapKeySql,
			languageCode, ldapName, "", admin, false, ldapActive, roleIds)
	}
	return id, false, nil
}
