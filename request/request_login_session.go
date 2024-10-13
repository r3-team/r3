package request

import (
	"r3/login/login_session"
)

func LoginSessionsGet() (interface{}, error) {
	return login_session.LogsGet()
}
