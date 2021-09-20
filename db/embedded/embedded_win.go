// +build windows

package embedded

import (
	"os/exec"
	"syscall"
)

func addSysProgAttrs(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}
