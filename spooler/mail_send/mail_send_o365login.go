package mail_send

import (
	"errors"
	"net/smtp"
)

// legacy O365 SMTP login auth
type loginAuthSimple struct {
	username string
	password string
}

func o365LoginAuth(username, password string) smtp.Auth {
	return &loginAuthSimple{username, password}
}
func (a *loginAuthSimple) Start(server *smtp.ServerInfo) (string, []byte, error) {
	return "LOGIN", []byte{}, nil
}
func (a *loginAuthSimple) Next(fromServer []byte, more bool) ([]byte, error) {
	if more {
		switch string(fromServer) {
		case "Username:":
			return []byte(a.username), nil
		case "Password:":
			return []byte(a.password), nil
		default:
			return nil, errors.New("Unknown fromServer")
		}
	}
	return nil, nil
}
