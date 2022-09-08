package cache

import (
	_ "embed"
)

var (
	//go:embed clients/r3_client_amd64_win.exe
	Client_amd64_win []byte

	//go:embed clients/r3_client_amd64_linux.bin
	Client_amd64_linux []byte

	//go:embed clients/r3_client_arm64_linux.bin
	Client_arm64_linux []byte

	//go:embed clients/r3_client_amd64_mac.dmg
	Client_amd64_mac []byte
)
