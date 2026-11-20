package cryptAesGcm

import (
	"crypto/aes"
	"crypto/cipher"
	"errors"
	"fmt"
	"r3/tools/crypt"

	"golang.org/x/crypto/argon2"
)

const (
	aesGcm256KeyBytes   uint32 = 32 // AES GCM requires 32 byte large secret
	aesGcm256NonceBytes uint32 = 12 // AES GCM requires 12 byte large nonce
)

func Decrypt(key []byte, cipherTextEnc []byte, nonce []byte) ([]byte, error) {
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
	return gcm.Open(nil, nonce, cipherTextEnc, nil)
}

// returns decrypted value as plain text, based on secret with unknown entropy
func DecryptWithWeakSecret(secret string, cipherTextEnc, saltKdf, nonce []byte) (string, error) {
	aesKey := DeriveKeyFromWeakSecret(secret, saltKdf, aesGcm256KeyBytes)
	cipherTextPlain, err := Decrypt(aesKey, cipherTextEnc, nonce)
	if err != nil {
		return "", err
	}
	return string(cipherTextPlain), nil
}

func Encrypt(key []byte, cipherTextPlain []byte, nonce []byte) ([]byte, error) {
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
	return gcm.Seal(nil, nonce, cipherTextPlain, nil), nil
}

// returns encrypted value as base64 encoded value, salt used for AES key and nonce used for encryption
// based on secret with unknown entropy
func EncryptWithWeakSecret(secret, cipherTextPlain string) ([]byte, []byte, []byte, error) {
	aesKeySalt, err := crypt.GetRandomBytes(16)
	if err != nil {
		return nil, nil, nil, err
	}
	aesKey := DeriveKeyFromWeakSecret(secret, aesKeySalt, aesGcm256KeyBytes)
	nonce, err := crypt.GetRandomBytes(aesGcm256NonceBytes)
	if err != nil {
		return nil, nil, nil, err
	}
	cipherTextEnc, err := Encrypt(aesKey, []byte(cipherTextPlain), nonce)
	if err != nil {
		return nil, nil, nil, err
	}
	return cipherTextEnc, aesKeySalt, nonce, nil
}

// get a strong key usuable for AES, based on string input with unknown entropy
// strong keys should not need it, but if source is unknown, use argon2 to derive a strong key from it
func DeriveKeyFromWeakSecret(secret string, salt []byte, bytesSize uint32) []byte {
	// could offer options in the future to increase effort
	// currently set to: 3 iterations, 64MB memory
	return argon2.IDKey([]byte(secret), salt, 3, 64*1024, 4, bytesSize)
}
