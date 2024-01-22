package scheduler

import (
	"encoding/json"
	"fmt"
	"r3/config"
	"r3/db"
	"r3/log"
	"r3/tools"
	"slices"
	"strings"
	"time"
)

func adminMails() error {
	now := tools.GetTimeUnix()
	reasonsSent := make([]string, 0) // avoid multiple mails for the same notification reason

	var templates = struct {
		intro                        string
		licenseExpirationBody        string
		licenseExpirationSubject     string
		oauthClientExpirationBody    string
		oauthClientExpirationSubject string
	}{
		intro: `<p>You are receiving this message, because your email address has been added to the REI3 admin notification list.</p>
		<p>To change this setting, please visit your REI3 instance: {URL}</p>`,
		licenseExpirationBody:        `<p>Your license expires on: {DATE}</p>`,
		licenseExpirationSubject:     `Your REI3 Professional license is about to expire`,
		oauthClientExpirationBody:    `<p>Your OAuth client expires on: {DATE}</p>`,
		oauthClientExpirationSubject: `Your REI3 OAuth client is about to expire`,
	}

	var sendMail = func(subject string, body string, dateExpiration int64, reason string) error {
		if slices.Contains(reasonsSent, reason) {
			return nil
		}

		// get mail receivers
		if config.GetString("adminMails") == "" {
			log.Warning("server", "cannot send admin notification mails", fmt.Errorf("no mail receivers defined"))
			return nil
		}

		var toList []string
		if err := json.Unmarshal([]byte(config.GetString("adminMails")), &toList); err != nil {
			return fmt.Errorf("cannot read admin mail receivers, %s", err.Error())
		}

		if len(toList) == 0 {
			log.Warning("server", "cannot send admin notification mails", fmt.Errorf("no mail receivers defined"))
			return nil
		}

		// apply intro
		body = fmt.Sprintf("%s%s", templates.intro, body)

		// replace known placeholders
		body = strings.Replace(body, "{URL}", config.GetString("publicHostName"), -1)
		body = strings.Replace(body, "{DATE}", time.Unix(dateExpiration, 0).String(), -1)

		if _, err := db.Pool.Exec(db.Ctx, `
			SELECT instance.mail_send($1,$2,$3)
		`, subject, body, strings.Join(toList, ",")); err != nil {
			return err
		}

		if _, err := db.Pool.Exec(db.Ctx, `
			UPDATE instance.admin_mail
			SET date_last_sent = DATE_PART('EPOCH',CURRENT_DATE)
			WHERE reason = $1
		`, reason); err != nil {
			return err
		}
		reasonsSent = append(reasonsSent, reason)
		return nil
	}

	// collect admin mail definitions
	type adminMail struct {
		reason         string
		daysBeforeList []int64
		dateLastSent   int64
	}
	adminMails := make([]adminMail, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT reason, days_before, date_last_sent
		FROM instance.admin_mail
	`)
	if err != nil {
		return err
	}

	for rows.Next() {
		var am adminMail
		if err := rows.Scan(&am.reason, &am.daysBeforeList, &am.dateLastSent); err != nil {
			return err
		}
		adminMails = append(adminMails, am)
	}
	rows.Close()

	// send admin mails
	for _, am := range adminMails {
		for _, daysBefore := range am.daysBeforeList {

			switch am.reason {
			case "licenseExpiration":
				if !config.GetLicenseUsed() {
					continue
				}
				dateExpiration := config.GetLicenseValidUntil()
				dateNotifySend := dateExpiration - (daysBefore * oneDayInSeconds)

				if now < dateNotifySend || am.dateLastSent > dateNotifySend {
					continue
				}

				if err := sendMail(
					templates.licenseExpirationSubject,
					templates.licenseExpirationBody,
					dateExpiration, am.reason); err != nil {

					return err
				}
			case "oauthClientExpiration":
			}
		}
	}
	return nil
}
