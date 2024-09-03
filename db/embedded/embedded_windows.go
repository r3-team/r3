//go:build windows

package embedded

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
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
	// returns true if DB server is running
	return strings.Contains(foundLine, msgState1), nil
}

// executes call and waits for specified lines to return
// will return automatically after timeout
func execWaitFor(call string, args []string, waitFor []string, waitTime int) (string, error) {

	ctx, _ := context.WithTimeout(context.Background(), time.Duration(waitTime)*time.Second)
	cmd := exec.CommandContext(ctx, call, args...)
	tools.CmdAddSysProgAttrs(cmd)
	cmd.Env = append(os.Environ(), fmt.Sprintf("LC_MESSAGES=%s", locale))

	// create as seperate process for clean shutdown, otherwise child progs are killed immediately on SIGINT
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", err
	}

	type chanReturnType struct {
		err  error
		line string
	}
	chanReturn := make(chan chanReturnType)

	// react to call timeout
	go func() {
		for {
			<-ctx.Done()
			chanReturn <- chanReturnType{err: errors.New("timeout reached")}
			return
		}
	}()

	// react to new lines from standard output
	go func() {
		if err := cmd.Start(); err != nil {
			chanReturn <- chanReturnType{err: err}
			return
		}

		buf := bufio.NewReader(stdout)
		bufLines := []string{}
		for {
			line, _, err := buf.ReadLine()
			if err != nil {
				if err != io.EOF {
					// log error if not end-of-file
					log.Error("server", "failed to read from std out", err)
				}
				break
			}
			bufLines = append(bufLines, string(line))

			// success if expected lines turned up
			for _, waitLine := range waitFor {
				if strings.Contains(string(line), waitLine) {
					chanReturn <- chanReturnType{
						err:  nil,
						line: waitLine,
					}
					return
				}
			}
		}

		if len(bufLines) == 0 {
			// nothing turned up
			chanReturn <- chanReturnType{err: errors.New("output is empty")}
		} else {
			// expected lines did not turn up
			chanReturn <- chanReturnType{err: fmt.Errorf("unexpected output, got: %s", strings.Join(bufLines, ","))}
		}
	}()

	res := <-chanReturn
	return res.line, res.err
}
