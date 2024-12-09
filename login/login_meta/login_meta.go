package login_meta

import (
	"context"
	"r3/db"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func Get(id int64) (types.LoginMeta, error) {
	var m types.LoginMeta

	err := db.Pool.QueryRow(db.Ctx, `
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

func Set_tx(ctx context.Context, tx pgx.Tx, id int64, meta types.LoginMeta) error {

	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT login_id FROM instance.login_meta WHERE login_id = $1)`, id).Scan(&exists); err != nil {
		return err
	}

	if !exists {
		if _, err := tx.Exec(ctx, `
			INSERT INTO instance.login_meta (
				login_id, email, department, location, name_display, name_fore, name_sur,
				notes, organization, phone_fax, phone_landline, phone_mobile
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		`, id, meta.Email, meta.Department, meta.Location, meta.NameDisplay, meta.NameFore,
			meta.NameSur, meta.Notes, meta.Organization, meta.PhoneFax, meta.PhoneLandline,
			meta.PhoneMobile); err != nil {

			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			UPDATE instance.login_meta
			SET email = $1, department = $2, location = $3, name_display = $4, name_fore = $5,
				name_sur = $6, notes = $7, organization = $8, phone_fax = $9, phone_landline = $10,
				phone_mobile = $11
			WHERE login_id = $12
		`, meta.Email, meta.Department, meta.Location, meta.NameDisplay, meta.NameFore,
			meta.NameSur, meta.Notes, meta.Organization, meta.PhoneFax, meta.PhoneLandline,
			meta.PhoneMobile, id); err != nil {

			return err
		}
	}
	return nil
}
