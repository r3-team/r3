package cache

import (
	"crypto/tls"
	"fmt"
	"os"
	"r3/log"
	"r3/tools"
	"sync"
)

var (
	cert_mx     sync.Mutex
	cert        tls.Certificate      // cert to serve
	certPath    string               // path to cert file
	certPathKey string               // path to cert key file
	certUnixMod int64           = -1 // cert file modification unix time (-1 if not loaded yet)
)

func CheckRenewCert() error {
	cert_mx.Lock()
	defer cert_mx.Unlock()

	// get stats for cert file
	file, err := os.Stat(certPath)
	if err != nil {
		if !os.IsNotExist(err) {
			return err
		}

		// cert file does not exist, check its key file
		keyFileExists, err := tools.Exists(certPathKey)
		if err != nil {
			return err
		}
		if keyFileExists {
			return fmt.Errorf("certificate file does not exist (%s), but its key file does (%s)",
				certPath, certPathKey)
		}

		// neither cert nor its key file exist, create new self signed cert
		// fallback if instance does not have a proper cert available at startup
		hostname, err := os.Hostname()
		if err != nil {
			return err
		}
		hosts := []string{"localhost", "127.0.0.1", "::1", hostname}

		if err := tools.CreateCertificate(hosts, "Generic Company", 36500, certPath, certPathKey); err != nil {
			return err
		}

		// get stats for newly created cert file
		file, err = os.Stat(certPath)
		if err != nil {
			return err
		}
	}

	if file.ModTime().Unix() != certUnixMod {
		log.Info("server", fmt.Sprintf("loading HTTP server certificate from '%s'", certPath))

		cert, err = tls.LoadX509KeyPair(certPath, certPathKey)
		if err != nil {
			return err
		}
		certUnixMod = file.ModTime().Unix()
	}
	return nil
}

func GetCert(*tls.ClientHelloInfo) (*tls.Certificate, error) {
	cert_mx.Lock()
	defer cert_mx.Unlock()
	return &cert, nil
}

func SetCertPaths(cert string, key string) {
	certPath = cert
	certPathKey = key
}
