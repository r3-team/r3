package cert

import (
	"os"
	"tools"
)

func CreateIfNotExist(certPath string, keyPath string) error {

	certFileExists, err := tools.Exists(certPath)
	if err != nil {
		return err
	}
	certKeyFileExists, err := tools.Exists(keyPath)
	if err != nil {
		return err
	}
	if certFileExists || certKeyFileExists {
		return nil
	}

	hostname, err := os.Hostname()
	if err != nil {
		return err
	}
	hosts := []string{"localhost", "127.0.0.1", "::1", hostname}

	// create self signed 100 year cert
	// fallback if instance does not have a proper cert available at startup
	if err := tools.CreateCertificate(hosts, "Generic Company", 36500, certPath, keyPath); err != nil {
		return err
	}
	return nil
}
