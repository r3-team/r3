package login_meta_map

import (
	"context"
	"fmt"
	"r3/types"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Set_tx(ctx context.Context, tx pgx.Tx, ldapId pgtype.Int4, oauthClientId pgtype.Int4, m types.LoginMeta) error {

	entity := "ldap_id"
	entityId := ldapId
	if oauthClientId.Valid {
		entity = "oauth_client_id"
		entityId = oauthClientId
	}

	var exists bool
	if err := tx.QueryRow(ctx, fmt.Sprintf(`
		SELECT EXISTS(
			SELECT ldap_id
			FROM instance.login_meta_map
			WHERE %s = $1
		)
	`, entity), entityId).Scan(&exists); err != nil {
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
			INSERT INTO instance.login_meta_map (
				ldap_id, oauth_client_id, department, email, location, name_display, name_fore,
				name_sur, notes, organization, phone_fax, phone_landline, phone_mobile
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		`, ldapId, oauthClientId, m.Department, m.Email, m.Location, m.NameDisplay,
			m.NameFore, m.NameSur, m.Notes, m.Organization, m.PhoneFax,
			m.PhoneLandline, m.PhoneMobile)
	} else {
		_, err = tx.Exec(ctx, fmt.Sprintf(`
			UPDATE instance.login_meta_map
			SET department = $1, email = $2, location = $3, name_display = $4,
				name_fore = $5, name_sur = $6, notes = $7, organization = $8,
				phone_fax = $9, phone_landline = $10, phone_mobile = $11
			WHERE %s = $12
		`, entity), m.Department, m.Email, m.Location, m.NameDisplay, m.NameFore,
			m.NameSur, m.Notes, m.Organization, m.PhoneFax, m.PhoneLandline,
			m.PhoneMobile, entityId)
	}
	return err
}
