//go:build windows

package embedded

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"r3/config"
	"r3/log"
	"r3/tools"
	"strings"
	"syscall"
	"time"
)

func Start() error {

	// check for existing embedded database path
	exists, err := tools.Exists(dbData)
	if err != nil {
		return err
	}
	if !exists {

		// get database from template
		if err := tools.FileMove(strings.Replace(dbData, "database", "database_template", 1),
			dbData, false); err != nil {

			return err
		}
	}

	// check embedded database state
	state, err := status()
	if err != nil {
		return err
	}

	if state {
		return fmt.Errorf("database already running, another instance is likely active")
	}
	_, err = execWaitFor(dbBinCtl, []string{"start", "-D", dbData,
		fmt.Sprintf(`-o "-p %d"`, config.File.Db.Port)}, []string{msgStarted}, 10)

	return err
}

func Stop() error {

	state, err := status()
	if err != nil {
		return err
	}

	if !state {
		log.Info("server", "embedded database already stopped")
		return nil
	}

	_, err = execWaitFor(dbBinCtl, []string{"stop", "-D", dbData}, []string{msgStopped}, 10)
	return err
}

func status() (bool, error) {

	foundLine, err := execWaitFor(dbBinCtl, []string{"status", "-D", dbData},
		[]string{msgState0, msgState1}, 5)

	if err != nil {
		return false, err
	}

	if strings.Contains(foundLine, msgState1) {
		return true, nil
	}
	return false, nil
}

// executes call and waits for specified lines to return
// will return automatically after timeout
func execWaitFor(call string, args []string, waitFor []string, waitTime int) (string, error) {

	ctx, _ := context.WithTimeout(context.Background(), time.Duration(waitTime)*time.Second)

	cmd := exec.CommandContext(ctx, call, args...)
	tools.CmdAddSysProgAttrs(cmd)
	cmd.Env = append(os.Environ(), fmt.Sprintf("LC_MESSAGES=%s", locale))

	// create as seperate process for clean shutdown, otherwise child progs are killed immediately on CTRL+C
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", err
	}

	done := make(chan bool)
	var doneErr error = nil
	var doneLine string = ""

	// react to call timeout
	go func() {
		for {
			<-ctx.Done()
			doneErr = errors.New("timeout reached")
			done <- true
			return
		}
	}()

	// react to new lines from standard output
	go func() {
		if err := cmd.Start(); err != nil {
			doneErr = err
			done <- true
			return
		}

		log := []string{}
		buf := bufio.NewReader(stdout)
		for {
			line, _, err := buf.ReadLine()
			if err != nil {
				doneErr = err
				break
			}
			log = append(log, string(line))

			// success if expected lines turned up
			for _, waitLine := range waitFor {

				if strings.Contains(string(line), waitLine) {

					doneLine = waitLine
					done <- true
					return
				}
			}
		}

		if len(log) == 0 {
			// nothing turned up
			doneErr = errors.New("output is empty")
			done <- true
			return
		}

		// expected lines did not turn up
		doneErr = fmt.Errorf("unexpected output, got: %s", strings.Join(log, ","))
		done <- true
	}()

	<-done
	return doneLine, doneErr
}
