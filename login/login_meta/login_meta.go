package login_meta

import (
	"context"
	"fmt"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func GetIsNotUnique_tx(ctx context.Context, tx pgx.Tx, loginId int64, content string, value string) (bool, error) {
	var query string
	switch content {
	case "email":
		query = `SELECT EXISTS(
			SELECT login_id
			FROM instance.login_meta
			WHERE login_id <> $1
			AND   email    =  $2
		)`
	case "name":
		query = `SELECT EXISTS(
			SELECT id
			FROM instance.login
			WHERE id   <> $1
			AND   name =  $2
		)`
	default:
		return false, fmt.Errorf("login unique check is not valid for content '%s'", content)
	}

	exists := false
	err := tx.QueryRow(ctx, query, loginId, value).Scan(&exists)
	return exists, err
}

func Get_tx(ctx context.Context, tx pgx.Tx, id int64) (types.LoginMeta, error) {
	var m types.LoginMeta

	err := tx.QueryRow(ctx, `
		SELECT email, department, location, name_display, name_fore, name_sur,
			notes, organization, phone_fax, phone_landline, phone_mobile
		FROM instance.login_meta
		WHERE login_id = $1
	`, id).Scan(&m.Email, &m.Department, &m.Location, &m.NameDisplay, &m.NameFore, &m.NameSur,
		&m.Notes, &m.Organization, &m.PhoneFax, &m.PhoneLandline, &m.PhoneMobile)

	if err != nil && err != pgx.ErrNoRows {
		return m, err
	}
	return m, nil
}

func GetDetailsMany_tx(ctx context.Context, tx pgx.Tx, ids []int64) (map[int64]types.LoginWithMeta, error) {

	rows, err := tx.Query(ctx, `
		SELECT l.id, l.name, m.email, m.department, m.location, m.name_display, m.name_fore,
			m.name_sur, m.notes, m.organization, m.phone_fax, m.phone_landline, m.phone_mobile
		FROM      instance.login      AS l
		LEFT JOIN instance.login_meta AS m ON m.login_id = l.id
		WHERE l.id = ANY($1)
	`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	m := make(map[int64]types.LoginWithMeta)
	for rows.Next() {
		var l types.LoginWithMeta
		if err := rows.Scan(&l.Id, &l.Name, &l.Meta.Email, &l.Meta.Department, &l.Meta.Location,
			&l.Meta.NameDisplay, &l.Meta.NameFore, &l.Meta.NameSur, &l.Meta.Notes, &l.Meta.Organization,
			&l.Meta.PhoneFax, &l.Meta.PhoneLandline, &l.Meta.PhoneMobile); err != nil {

			return nil, err
		}
		m[l.Id] = l
	}
	if len(ids) != len(m) {
		return nil, fmt.Errorf("failed fetching login details, %d records requested, %d returned", len(ids), len(m))
	}
	return m, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, id int64, meta types.LoginMeta) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO instance.login_meta (
			email, department, location, name_display, name_fore, name_sur,
			notes, organization, phone_fax, phone_landline, phone_mobile, login_id
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (login_id) DO UPDATE
		SET email = $1, department = $2, location = $3, name_display = $4, name_fore = $5,
			name_sur = $6, notes = $7, organization = $8, phone_fax = $9, phone_landline = $10,
			phone_mobile = $11
	`, meta.Email, meta.Department, meta.Location, meta.NameDisplay, meta.NameFore,
		meta.NameSur, meta.Notes, meta.Organization, meta.PhoneFax, meta.PhoneLandline,
		meta.PhoneMobile, id)

	return err
}
