// +build darwin

package embedded

import (
	"os/exec"
)

func addSysProgAttrs(cmd *exec.Cmd) {
	// darwin users should not use embedded to begin with
}
