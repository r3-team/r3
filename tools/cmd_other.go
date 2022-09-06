//go:build !windows

package tools

import (
	"os/exec"
)

func CmdAddSysProgAttrs(cmd *exec.Cmd) {
	// Windows-only
}
