package crypt

import (
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"io"
)

func GetHash(v string) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(v)))
}

func GetRandomBytes(size uint32) ([]byte, error) {
	v := make([]byte, size)
	if _, err := io.ReadFull(rand.Reader, v); err != nil {
		return nil, err
	}
	return v, nil
}
