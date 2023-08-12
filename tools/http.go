package tools

import (
	"crypto/tls"
	"net/http"
	"time"
)

func GetHttpClient(skipVerify bool) http.Client {

	tlsConfig := tls.Config{
		InsecureSkipVerify:       skipVerify,
		PreferServerCipherSuites: true,
	}
	httpTransport := &http.Transport{
		TLSHandshakeTimeout: 5 * time.Second,
		TLSClientConfig:     &tlsConfig,
	}
	return http.Client{
		Timeout:   time.Second * 30,
		Transport: httpTransport,
	}
}
