package bruteforce

import (
	"net"
	"net/http"
	"r3/config"
	"r3/types"
	"sync"
)

var (
	access_mx sync.RWMutex
	attempts  int  = 100   // max allowed failed attempts before block
	enabled   bool = false // enable bruteforce protection

	hostMapTracked = make(map[string]int)
	hostMapBlocked = make(map[string]types.Void)
)

func SetConfig() {
	access_mx.Lock()
	attempts = int(config.GetUint64("bruteforceAttempts"))
	enabled = config.GetUint64("bruteforceProtection") == 1
	access_mx.Unlock()

	if !enabled {
		ClearHostMap()
	}
}

// returns counts of tracked and blocked hosts
func GetCounts() (int, int) {
	access_mx.RLock()
	defer access_mx.RUnlock()
	return len(hostMapTracked), len(hostMapBlocked)
}

// returns if request should be blocked due to assumed bruteforce attempt
func Check(r *http.Request) bool {

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return true
	}
	return CheckByHost(host)
}

// like Check() but with host string instead of http.Request
func CheckByHost(host string) bool {
	access_mx.RLock()
	defer access_mx.RUnlock()

	if !enabled {
		return false
	}

	_, exists := hostMapBlocked[host]
	return exists
}

// store bad authentication attempt
// is used to make assumptions about bruteforce attempts
// uses host part of source address to identify source
func BadAttempt(r *http.Request) {

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		// logging error case could flood the logs
		return
	}
	BadAttemptByHost(host)
}

func BadAttemptByHost(host string) {

	// ignore local access
	if host == "::1" || host == "localhost" || host == "127.0.0.1" {
		return
	}

	access_mx.Lock()
	defer access_mx.Unlock()

	// host not known yet, track from now on
	if _, exists := hostMapTracked[host]; !exists {
		hostMapTracked[host] = 1
		return
	}

	// max allowed attempts reached, block host
	if hostMapTracked[host] > attempts {
		delete(hostMapTracked, host)
		hostMapBlocked[host] = types.Void{}
		return
	}

	// host is known but not yet blocked
	hostMapTracked[host]++
}

func ClearHostMap() error {
	access_mx.Lock()
	defer access_mx.Unlock()

	hostMapTracked = make(map[string]int)
	hostMapBlocked = make(map[string]types.Void)
	return nil
}
