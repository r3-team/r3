package request

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
)

func KeyCreate(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		KeyLength int `json:"keyLength"`
	}
	var res struct {
		Private string `json:"private"`
		Public  string `json:"public"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	// generate key pair
	priv, err := rsa.GenerateKey(rand.Reader, req.KeyLength)
	if err != nil {
		return nil, err
	}

	// write private PEM block
	buf := new(bytes.Buffer)

	if err := pem.Encode(buf, &pem.Block{Type: "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(priv)}); err != nil {

		return nil, err
	}
	res.Private = buf.String()

	// write public PEM block
	buf = new(bytes.Buffer)

	if err := pem.Encode(buf, &pem.Block{Type: "RSA PUBLIC KEY",
		Bytes: x509.MarshalPKCS1PublicKey(&priv.PublicKey)}); err != nil {

		return nil, err
	}
	res.Public = buf.String()

	return res, nil
}
