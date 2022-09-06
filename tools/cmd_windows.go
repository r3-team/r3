//go:build windows

package tools

import (
	"os/exec"
	"syscall"
)

func CmdAddSysProgAttrs(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}
