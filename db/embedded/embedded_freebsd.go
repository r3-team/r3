// +build freebsd

package embedded

import (
	"os/exec"
)

func addSysProgAttrs(cmd *exec.Cmd) {
	// freebsd users should not use embedded to begin with
}
