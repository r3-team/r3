package mail_receive

import (
	"encoding/json"
	"fmt"

	"github.com/emersion/go-sasl"
)

// implement XOAUTH2 separately as go-imap removed support for it
type xoauth2Client struct {
	Username string
	Token    string
}
type Xoauth2Error struct {
	Status  string `json:"status"`
	Schemes string `json:"schemes"`
	Scope   string `json:"scope"`
}

func (a *xoauth2Client) Start() (mech string, ir []byte, err error) {
	mech = "XOAUTH2"
	ir = []byte("user=" + a.Username + "\x01auth=Bearer " + a.Token + "\x01\x01")
	return
}
func (a *xoauth2Client) Next(challenge []byte) ([]byte, error) {
	xoauth2Err := &Xoauth2Error{}
	if err := json.Unmarshal(challenge, xoauth2Err); err != nil {
		return nil, err
	} else {
		return nil, xoauth2Err
	}
}
func (err *Xoauth2Error) Error() string {
	return fmt.Sprintf("XOAUTH2 authentication error (%v)", err.Status)
}
func newXoauth2Client(username, token string) sasl.Client {
	return &xoauth2Client{username, token}
}
