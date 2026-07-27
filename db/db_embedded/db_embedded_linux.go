//go:build linux || darwin

package db_embedded

import "fmt"

func Start() error {
	return fmt.Errorf("embedded database is only supported on Windows")
}
func Stop() error {
	return fmt.Errorf("embedded database is only supported on Windows")
}
