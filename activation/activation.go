package activation

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"r3/config"
	"r3/log"
	"r3/types"
)

// public key of OC2020_license_key, created 2020-10-05
var publicKey = `-----BEGIN RSA PUBLIC KEY-----
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
-----END RSA PUBLIC KEY-----`

func SetLicense() {
	if config.GetString("licenseFile") == "" {
		log.Info("server", "skipping activation check, no license installed")

		// set empty in case license was removed
		config.SetLicense(types.License{})
		return
	}

	var licFile types.LicenseFile

	if err := json.Unmarshal([]byte(config.GetString("licenseFile")), &licFile); err != nil {
		log.Error("server", "could not unmarshal license from config", err)
		return
	}

	licenseJson, err := json.Marshal(licFile.License)
	if err != nil {
		log.Error("server", "could not marshal license data", err)
		return
	}
	hashed := sha256.Sum256(licenseJson)

	// get license signature
	signature, err := base64.URLEncoding.DecodeString(licFile.Signature)
	if err != nil {
		log.Error("server", "could not decode license signature", err)
		return
	}

	// verify signature
	data, _ := pem.Decode([]byte(publicKey))
	if data == nil {
		log.Error("server", "could not decode public key", errors.New(""))
		return
	}
	key, err := x509.ParsePKCS1PublicKey(data.Bytes)
	if err != nil {
		log.Error("server", "could not parse public key", errors.New(""))
		return
	}

	if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, hashed[:], signature); err != nil {
		log.Error("server", "failed to verify license", err)
		return
	}

	// set license
	log.Info("server", "setting license")
	config.SetLicense(licFile.License)
}
