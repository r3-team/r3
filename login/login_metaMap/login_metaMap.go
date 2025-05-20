package login_metaMap

import (
	"context"
	"fmt"
	"r3/login/login_external"
	"r3/types"
	"strings"

	"github.com/jackc/pgx/v5"
)

func Get_tx(ctx context.Context, tx pgx.Tx, entity string, entityId int32) (types.LoginMeta, error) {

	var m types.LoginMeta
	if err := login_external.ValidateEntity(entity); err != nil {
		return m, err
	}

	err := tx.QueryRow(ctx, fmt.Sprintf(`
		SELECT
			COALESCE(department, ''),
			COALESCE(email, ''),
			COALESCE(location, ''),
			COALESCE(name_display, ''),
			COALESCE(name_fore, ''),
			COALESCE(name_sur, ''),
			COALESCE(notes, ''),
			COALESCE(organization, ''),
			COALESCE(phone_fax, ''),
			COALESCE(phone_landline, ''),
			COALESCE(phone_mobile, '')
		FROM instance.login_meta_map
		WHERE %s_id = $1
	`, entity), entityId).Scan(&m.Department, &m.Email, &m.Location, &m.NameDisplay, &m.NameFore,
		&m.NameSur, &m.Notes, &m.Organization, &m.PhoneFax, &m.PhoneLandline, &m.PhoneMobile)

	if err != nil && err != pgx.ErrNoRows {
		return m, err
	}
	return m, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, entity string, entityId int32, m types.LoginMeta) error {

	if err := login_external.ValidateEntity(entity); err != nil {
		return err
	}

	var exists bool
	if err := tx.QueryRow(ctx, fmt.Sprintf(`
		SELECT EXISTS(
			SELECT ldap_id
			FROM instance.login_meta_map
			WHERE %s_id = $1
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
		_, err = tx.Exec(ctx, fmt.Sprintf(`
			INSERT INTO instance.login_meta_map (
				%s_id, department, email, location, name_display, name_fore, name_sur,
				notes, organization, phone_fax, phone_landline, phone_mobile
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		`, entity), entityId, m.Department, m.Email, m.Location, m.NameDisplay,
			m.NameFore, m.NameSur, m.Notes, m.Organization, m.PhoneFax,
			m.PhoneLandline, m.PhoneMobile)
	} else {
		_, err = tx.Exec(ctx, fmt.Sprintf(`
			UPDATE instance.login_meta_map
			SET department = $1, email = $2, location = $3, name_display = $4,
				name_fore = $5, name_sur = $6, notes = $7, organization = $8,
				phone_fax = $9, phone_landline = $10, phone_mobile = $11
			WHERE %s_id = $12
		`, entity), m.Department, m.Email, m.Location, m.NameDisplay, m.NameFore,
			m.NameSur, m.Notes, m.Organization, m.PhoneFax, m.PhoneLandline,
			m.PhoneMobile, entityId)
	}
	return err
}

// for every meta field mapped, check if there is any difference between old and new login meta data
// returns updated login meta data and TRUE if a change occured
func UpdateChangedMeta(metaMap types.LoginMeta, metaOld types.LoginMeta, metaNew types.LoginMeta) (types.LoginMeta, bool) {
	updated := false
	if metaMap.Department != "" && metaNew.Department != metaOld.Department {
		metaOld.Department = metaNew.Department
		updated = true
	}
	if metaMap.Email != "" && metaNew.Email != metaOld.Email {
		metaOld.Email = metaNew.Email
		updated = true
	}
	if metaMap.Location != "" && metaNew.Location != metaOld.Location {
		metaOld.Location = metaNew.Location
		updated = true
	}
	if metaMap.NameDisplay != "" && metaNew.NameDisplay != metaOld.NameDisplay {
		metaOld.NameDisplay = metaNew.NameDisplay
		updated = true
	}
	if metaMap.NameFore != "" && metaNew.NameFore != metaOld.NameFore {
		metaOld.NameFore = metaNew.NameFore
		updated = true
	}
	if metaMap.NameSur != "" && metaNew.NameSur != metaOld.NameSur {
		metaOld.NameSur = metaNew.NameSur
		updated = true
	}
	if metaMap.Notes != "" && metaNew.Notes != metaOld.Notes {
		metaOld.Notes = metaNew.Notes
		updated = true
	}
	if metaMap.Organization != "" && metaNew.Organization != metaOld.Organization {
		metaOld.Organization = metaNew.Organization
		updated = true
	}
	if metaMap.PhoneFax != "" && metaNew.PhoneFax != metaOld.PhoneFax {
		metaOld.PhoneFax = metaNew.PhoneFax
		updated = true
	}
	if metaMap.PhoneLandline != "" && metaNew.PhoneLandline != metaOld.PhoneLandline {
		metaOld.PhoneLandline = metaNew.PhoneLandline
		updated = true
	}
	if metaMap.PhoneMobile != "" && metaNew.PhoneMobile != metaOld.PhoneMobile {
		metaOld.PhoneMobile = metaNew.PhoneMobile
		updated = true
	}
	return metaOld, updated
}

func ReadMetaFromMapIf(metaMap types.LoginMeta, dataIf map[string]interface{}) types.LoginMeta {
	var metaNew types.LoginMeta

	if metaMap.Department != "" {
		if v, ok := dataIf[metaMap.Department]; ok {
			if s, ok := v.(string); ok {
				metaNew.Department = s
			}
		}
	}
	if metaMap.Email != "" {
		if v, ok := dataIf[metaMap.Email]; ok {
			if s, ok := v.(string); ok {
				metaNew.Email = s
			}
		}
	}
	if metaMap.Location != "" {
		if v, ok := dataIf[metaMap.Location]; ok {
			if s, ok := v.(string); ok {
				metaNew.Location = s
			}
		}
	}
	if metaMap.NameDisplay != "" {
		if v, ok := dataIf[metaMap.NameDisplay]; ok {
			if s, ok := v.(string); ok {
				metaNew.NameDisplay = s
			}
		}
	}
	if metaMap.NameFore != "" {
		if v, ok := dataIf[metaMap.NameFore]; ok {
			if s, ok := v.(string); ok {
				metaNew.NameFore = s
			}
		}
	}
	if metaMap.NameSur != "" {
		if v, ok := dataIf[metaMap.NameSur]; ok {
			if s, ok := v.(string); ok {
				metaNew.NameSur = s
			}
		}
	}
	if metaMap.Notes != "" {
		if v, ok := dataIf[metaMap.Notes]; ok {
			if s, ok := v.(string); ok {
				metaNew.Notes = s
			}
		}
	}
	if metaMap.Organization != "" {
		if v, ok := dataIf[metaMap.Organization]; ok {
			if s, ok := v.(string); ok {
				metaNew.Organization = s
			}
		}
	}
	if metaMap.PhoneFax != "" {
		if v, ok := dataIf[metaMap.PhoneFax]; ok {
			if s, ok := v.(string); ok {
				metaNew.PhoneFax = s
			}
		}
	}
	if metaMap.PhoneLandline != "" {
		if v, ok := dataIf[metaMap.PhoneLandline]; ok {
			if s, ok := v.(string); ok {
				metaNew.PhoneLandline = s
			}
		}
	}
	if metaMap.PhoneMobile != "" {
		if v, ok := dataIf[metaMap.PhoneMobile]; ok {
			if s, ok := v.(string); ok {
				metaNew.PhoneMobile = s
			}
		}
	}
	return metaNew
}
