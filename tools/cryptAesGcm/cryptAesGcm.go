package cryptAesGcm

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"errors"
	"fmt"
	"r3/tools/crypt"

	"golang.org/x/crypto/argon2"
)

const (
	aesGcm256KeyBytes   uint32 = 32 // AES GCM requires 32 byte large secret
	aesGcm256NonceBytes uint32 = 12 // AES GCM requires 12 byte large nonce
)

func Decrypt(key []byte, cipherEnc []byte, nonce []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, errors.New("AES-GCM-256 requires 32 byte key")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(nonce) != gcm.NonceSize() {
		return nil, fmt.Errorf("invalid nonce size, %d bytes expected", gcm.NonceSize())
	}
	return gcm.Open(nil, nonce, cipherEnc, nil)
}

// returns decrypted value as plain text
// based on secret with unknown entropy
func DecryptUnknownSecret(cipherEnc, secret, saltKdf, nonce string) (string, error) {
	aesKey := DeriveKeyFromUnknownSecret(secret, []byte(saltKdf), aesGcm256KeyBytes)
	cipherPlain, err := Decrypt(aesKey, []byte(cipherEnc), []byte(nonce))
	if err != nil {
		return "", err
	}
	return string(cipherPlain), nil
}

func Encrypt(key []byte, cipherPlain []byte, nonce []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, errors.New("AES-GCM-256 requires 32 byte key")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(nonce) != gcm.NonceSize() {
		return nil, fmt.Errorf("invalid nonce size, %d bytes expected", gcm.NonceSize())
	}
	return gcm.Seal(nil, nonce, cipherPlain, nil), nil
}

// returns encrypted value as base64 encoded value, salt used for AES key and nonce used for encryption
// based on secret with unknown entropy
func EncryptUnknownSecret(secret, cipherPlain string) (string, string, string, error) {
	aesKeySalt, err := crypt.GetRandomBytes(16)
	if err != nil {
		return "", "", "", err
	}
	aesKey := DeriveKeyFromUnknownSecret(secret, aesKeySalt, aesGcm256KeyBytes)
	nonce, err := crypt.GetRandomBytes(aesGcm256NonceBytes)
	if err != nil {
		return "", "", "", err
	}
	cipherEnc, err := Encrypt(aesKey, []byte(cipherPlain), nonce)
	if err != nil {
		return "", "", "", err
	}
	return base64.StdEncoding.EncodeToString(cipherEnc), string(aesKeySalt), string(nonce), nil
}

// get a strong key usuable for AES, based on string input with unknown entropy
// strong keys should not need it, but if source is unknown, use argon2 to derive a strong key from it
func DeriveKeyFromUnknownSecret(secret string, salt []byte, bytesSize uint32) []byte {
	// could offer options in the future to increase effort
	// currently set to: 3 iterations, 64MB memory
	return argon2.IDKey([]byte(secret), salt, 3, 64*1024, 4, bytesSize)
}
