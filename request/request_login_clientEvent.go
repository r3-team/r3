package request

import (
	"r3/login/login_clientEvent"
)

func loginClientEventGet(loginId int64) (interface{}, error) {
	return login_clientEvent.Get(loginId)
}
