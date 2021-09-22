package tools

import (
	"bufio"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net"
	"os"
	"time"
)

// hash
func Hash(text string) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(text)))
}
func HashAsByteArray(text string) []byte {
	hash := sha256.Sum256([]byte(text))
	return hash[0:]
}

// hosts can be a comma-separated list of hosts
func CreateCertificate(hosts []string, organization string, validDays uint,
	certFilePath string, keyFilePath string) error {

	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return err
	}

	validFrom := time.Now()
	validFor := validFrom.Add(24 * time.Hour * time.Duration(validDays))

	// generate serial number
	serialNumberLimit := new(big.Int).Lsh(big.NewInt(1), 128)
	serialNumber, err := rand.Int(rand.Reader, serialNumberLimit)
	if err != nil {
		return err
	}

	template := x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			Organization: []string{organization},
		},
		NotBefore:             validFrom,
		NotAfter:              validFor,
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}

	for _, host := range hosts {

		if ip := net.ParseIP(host); ip != nil {
			template.IPAddresses = append(template.IPAddresses, ip)
		} else {
			template.DNSNames = append(template.DNSNames, host)
		}
	}

	// generate certification file
	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, publicKey(priv), priv)
	if err != nil {
		return err
	}

	certOut, err := os.Create(certFilePath)
	if err != nil {
		return err
	}

	if err := pem.Encode(certOut, &pem.Block{Type: "CERTIFICATE", Bytes: derBytes}); err != nil {
		return err
	}

	if err := certOut.Close(); err != nil {
		return err
	}

	// generate certificate key
	keyOut, err := os.OpenFile(keyFilePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}

	pemBlock, err := pemBlockForKey(priv)
	if err != nil {
		return err
	}

	if err := pem.Encode(keyOut, pemBlock); err != nil {
		return err
	}

	if err := keyOut.Close(); err != nil {
		return err
	}
	return nil
}

// encrypt string to base64 crypto using AES
func Encrypt(key string, text string) (string, error) {

	plaintext := []byte(text)

	// AES only allows certain key sizes, hash with sha256 to get 32 bytes
	block, err := aes.NewCipher(HashAsByteArray(key))
	if err != nil {
		return "", err
	}

	// The IV needs to be unique, but not secure. Therefore it's common to
	// include it at the beginning of the ciphertext.
	ciphertext := make([]byte, aes.BlockSize+len(plaintext))
	iv := ciphertext[:aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}

	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[aes.BlockSize:], plaintext)

	// encode ciphertext to base64
	return base64.URLEncoding.EncodeToString(ciphertext), nil
}

// decrypt from base64 to decrypted string
func Decrypt(key string, cryptoText string) (string, error) {

	// decode ciphertext from base64
	ciphertext, _ := base64.URLEncoding.DecodeString(cryptoText)

	// AES only allows certain key sizes, hash with sha256 to get 32 bytes
	block, err := aes.NewCipher(HashAsByteArray(key))
	if err != nil {
		return "", err
	}

	// The IV needs to be unique, but not secure. Therefore it's common to
	// include it at the beginning of the ciphertext.
	if len(ciphertext) < aes.BlockSize {
		return "", errors.New("ciphertext too short")
	}
	iv := ciphertext[:aes.BlockSize]
	ciphertext = ciphertext[aes.BlockSize:]

	stream := cipher.NewCFBDecrypter(block, iv)

	// XORKeyStream can work in-place if the two arguments are the same.
	stream.XORKeyStream(ciphertext, ciphertext)

	return fmt.Sprintf("%s", ciphertext), nil
}

// key handling
func ReadPrivKey(filePath string) (*rsa.PrivateKey, error) {

	data, err := readPemBlockFromFile(filePath)
	if err != nil {
		return nil, err
	}

	key, err := x509.ParsePKCS1PrivateKey(data.Bytes)
	if err != nil {
		return nil, err
	}
	return key, nil
}

func ReadPubKey(filePath string) (*rsa.PublicKey, error) {

	data, err := readPemBlockFromFile(filePath)
	if err != nil {
		return nil, err
	}

	key, err := x509.ParsePKCS1PublicKey(data.Bytes)
	if err != nil {
		return nil, err
	}
	return key, nil
}
func readPemBlockFromFile(filePath string) (*pem.Block, error) {

	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	pemfileinfo, err := file.Stat()
	if err != nil {
		return nil, err
	}
	pembytes := make([]byte, pemfileinfo.Size())
	buffer := bufio.NewReader(file)
	if _, err = buffer.Read(pembytes); err != nil {
		return nil, err
	}
	data, _ := pem.Decode([]byte(pembytes))
	return data, nil
}

func publicKey(priv interface{}) interface{} {

	switch k := priv.(type) {
	case *rsa.PrivateKey:
		return &k.PublicKey
	case *ecdsa.PrivateKey:
		return &k.PublicKey
	default:
		return nil
	}
}

func pemBlockForKey(priv interface{}) (*pem.Block, error) {

	switch k := priv.(type) {
	case *rsa.PrivateKey:
		return &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(k)}, nil
	case *ecdsa.PrivateKey:
		b, err := x509.MarshalECPrivateKey(k)
		if err != nil {
			return nil, err
		}
		return &pem.Block{Type: "EC PRIVATE KEY", Bytes: b}, nil
	default:
		return nil, errors.New("unknown priv type")
	}
}
