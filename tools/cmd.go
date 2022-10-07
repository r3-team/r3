package tools

import (
	"fmt"
	"os/exec"
	"runtime"
)

func OpenRessource(path string) error {
	var cmd *exec.Cmd

	// open file depending on runtime environment
	switch runtime.GOOS {
	case "darwin", "freebsd", "linux":
		cmd = exec.Command("xdg-open", path)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", path)
	default:
		return fmt.Errorf("unsupported runtime environment '%v' for object open",
			runtime.GOOS)
	}
	return cmd.Run()
}
