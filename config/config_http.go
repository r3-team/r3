package config

import (
	"crypto/tls"
	"net/http"
	"net/url"
	"time"
)

var (
	timeoutHandshake = time.Duration(5)
)

func GetHttpClient(skipVerify bool, timeoutHttp int64) (http.Client, error) {

	tlsConfig := tls.Config{
		InsecureSkipVerify:       skipVerify,
		PreferServerCipherSuites: true,
	}
	transport := &http.Transport{
		TLSHandshakeTimeout: time.Second * time.Duration(timeoutHandshake),
		TLSClientConfig:     &tlsConfig,
	}

	if GetString("proxyUrl") != "" {
		proxyUrl, err := url.Parse(GetString("proxyUrl"))
		if err != nil {
			return http.Client{}, err
		}
		transport.Proxy = http.ProxyURL(proxyUrl)
	}
	return http.Client{
		Timeout:   time.Second * time.Duration(timeoutHttp),
		Transport: transport,
	}, nil
}
