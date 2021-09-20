package request

import (
	"encoding/json"
	"r3/bruteforce"
)

func BruteforceGet(reqJson json.RawMessage) (interface{}, error) {

	var res struct {
		HostsTracked int `json:"hostsTracked"`
		HostsBlocked int `json:"hostsBlocked"`
	}
	res.HostsTracked, res.HostsBlocked = bruteforce.GetCounts()
	return res, nil
}
