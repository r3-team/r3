package scheduler

import (
	"errors"
	"fmt"
	"r3/backup"
	"r3/bruteforce"
	"r3/config"
	"r3/data"
	"r3/db"
	"r3/ldap/ldap_import"
	"r3/log"
	"r3/mail"
	"r3/repo"
	"r3/schema/lookups"
	"r3/tools"
	"sync"
	"time"

	"github.com/gofrs/uuid"
)

type schedule struct {
	// states
	interval     int64  // execution interval
	intervalType string // type of interval (seconds, minutes, hours, days, weeks, months, years, once)
	runLastUnix  int64  // unix time of last execution time of this schedule

	// target day for interval types weeks/months
	atDay int

	// target time for interval types days/weeks/months
	atHour   int
	atMinute int
	atSecond int
}
type task struct {
	fn                func() error           // function to execute
	name              string                 // task name
	nameLog           string                 // task log name
	pgFunctionId      uuid.UUID              // ID of PG function (from PG function schedulers)
	running           bool                   // task running state (block parallel execution)
	runNextScheduleId uuid.UUID              // ID of next schedule to run
	runNextUnix       int64                  // unix time of next task execution time (earliest schedule), -1 if it should not run
	scheduleIdMap     map[uuid.UUID]schedule // map of all schedules for this task (key: PG function schedule ID, NIL if system task)
}

var (
	change_mx             = &sync.Mutex{}
	initCounter     int   = 0               // counter of times tasks were initialized
	runEarliestUnix int64 = 0               // unix time of next (earliest) task to run
	tasks                 = make([]task, 0) // all tasks

	// main loop
	loopInterval          = time.Second * time.Duration(1)  // loop interval
	loopIntervalStartWait = time.Second * time.Duration(10) // loop waits at start
	loopRunning           = false                           // loop state, stops if set to false
)

func Start() error {
	change_mx.Lock()
	defer change_mx.Unlock()

	// (re)build task list
	runEarliestUnix = 0
	tasks = make([]task, 0)

	// get system tasks and their states
	rows, err := db.Pool.Query(db.Ctx, `
		SELECT t.name, t.embedded_only, t.interval_seconds, s.date_attempt
		FROM instance.task AS t
		INNER JOIN instance.scheduler AS s ON s.task_name = t.name
		WHERE t.active
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var t task
		var s schedule
		var embeddedOnly bool

		if err := rows.Scan(&t.name, &embeddedOnly, &s.interval, &s.runLastUnix); err != nil {
			return err
		}

		if embeddedOnly && !config.File.Db.Embedded {
			continue
		}

		// system tasks currently have a single schedule, every x seconds
		s.intervalType = "seconds"

		// system task schedule never ran, use now as starting point
		// update check should however run immediately (in case of important security update)
		if s.runLastUnix == 0 && t.name != "updateCheck" {
			s.runLastUnix = tools.GetTimeUnix()
		}

		t.scheduleIdMap = make(map[uuid.UUID]schedule)
		t.scheduleIdMap[uuid.Nil] = s

		t.runNextUnix, t.runNextScheduleId = getNextRunScheduleFromTask(t)

		switch t.name {
		case "cleanupBruteforce":
			t.nameLog = "Cleanup of bruteforce cache"
			t.fn = bruteforce.ClearHostMap
		case "cleanupTempDir":
			t.nameLog = "Cleanup of temp. directory"
			t.fn = cleanupTemp
		case "cleanupDataLogs":
			t.nameLog = "Cleanup of data change logs"
			t.fn = data.DelLogsBackground
		case "cleanupLogs":
			t.nameLog = "Cleanup of system logs"
			t.fn = cleanupLogs
		case "cleanupFiles":
			t.nameLog = "Cleanup of not-referenced files"
			t.fn = cleanUpFiles
		case "embeddedBackup":
			t.nameLog = "Integrated full backups"
			t.fn = backup.Run
		case "importLdapLogins":
			t.nameLog = "Import from LDAP connections"
			t.fn = ldap_import.RunAll
		case "mailAttach":
			t.nameLog = "Email attachment transfer"
			t.fn = mail.Attach_all
		case "mailRetrieve":
			t.nameLog = "Email retrieval"
			t.fn = mail.ReceiveAll
		case "mailSend":
			t.nameLog = "Email dispatch"
			t.fn = mail.SendAll
		case "repoCheck":
			t.nameLog = "Check for updates from repository"
			t.fn = repo.Update
		case "updateCheck":
			t.nameLog = "Check for platform updates from official website"
			t.fn = updateCheck
		default:
			return fmt.Errorf("unknown task '%s'", t.name)
		}
		tasks = append(tasks, t)
	}

	// get PG function schedules
	pgFunctionIdMapTasks := make(map[uuid.UUID]task)

	rows, err = db.Pool.Query(db.Ctx, `
		SELECT f.name, f.name, fs.pg_function_id, fs.id, fs.at_hour, fs.at_minute,
			fs.at_second, fs.at_day, fs.interval_type, fs.interval_value,
			s.date_attempt
		FROM app.pg_function AS f
		INNER JOIN app.pg_function_schedule AS fs ON fs.pg_function_id         = f.id
		INNER JOIN instance.scheduler       AS s  ON s.pg_function_schedule_id = fs.id
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var t task
		var s schedule
		var scheduleId uuid.UUID

		t.scheduleIdMap = make(map[uuid.UUID]schedule)

		if err := rows.Scan(&t.name, &t.nameLog, &t.pgFunctionId,
			&scheduleId, &s.atHour, &s.atMinute, &s.atSecond, &s.atDay,
			&s.intervalType, &s.interval, &s.runLastUnix); err != nil {

			return err
		}

		if _, exists := pgFunctionIdMapTasks[t.pgFunctionId]; exists {
			t = pgFunctionIdMapTasks[t.pgFunctionId]
		}

		t.scheduleIdMap[scheduleId] = s
		pgFunctionIdMapTasks[t.pgFunctionId] = t
	}
	for _, t := range pgFunctionIdMapTasks {
		t.runNextUnix, t.runNextScheduleId = getNextRunScheduleFromTask(t)
		tasks = append(tasks, t)
	}

	// start main task loop
	if !loopRunning && len(tasks) != 0 {
		loopRunning = true
		initCounter++
		go mainLoop()
	}
	return nil
}

func Stop() {
	change_mx.Lock()
	defer change_mx.Unlock()

	loopRunning = false
	log.Info("scheduler", "stopped")
}

// trigger task directly from outside
// either by name of system task or by choosing a PG function scheduler
func TriggerTask(systemTaskName string, pgFunctionId uuid.UUID, pgFunctionScheduleId uuid.UUID) {
	taskIndexToRun := -1

	// identify task index to run
	change_mx.Lock()
	if systemTaskName != "" {
		for i, t := range tasks {
			if t.pgFunctionId == uuid.Nil && t.name == systemTaskName {
				taskIndexToRun = i
				break
			}
		}
	} else {
		for i, t := range tasks {
			if t.pgFunctionId != pgFunctionId {
				continue
			}

			// set specific schedule to execute
			if _, exists := t.scheduleIdMap[pgFunctionScheduleId]; exists {
				tasks[i].runNextScheduleId = pgFunctionScheduleId
				taskIndexToRun = i
			}
		}
	}
	change_mx.Unlock()

	// if task was found, run it and wait for it to finish
	if taskIndexToRun != -1 {
		runTaskByIndex(taskIndexToRun)
	}
}

func mainLoop() {
	// wait after startup for background tasks to start
	time.Sleep(loopIntervalStartWait)

	log.Info("scheduler", "started")

	for {
		time.Sleep(loopInterval)

		change_mx.Lock()
		if !loopRunning {
			change_mx.Unlock()
			return
		}

		// get earliest unix time for any task to run
		if runEarliestUnix == 0 {

			var taskNameNext string
			for _, t := range tasks {

				// task is running or should not run anymore (-1)
				if t.running || t.runNextUnix == -1 {
					continue
				}

				if runEarliestUnix == 0 || t.runNextUnix < runEarliestUnix {
					runEarliestUnix = t.runNextUnix
					taskNameNext = t.nameLog
				}
			}
			log.Info("scheduler", fmt.Sprintf("set earliest next task execution time at %s for '%s'",
				time.Unix(runEarliestUnix, 0), taskNameNext))
		}

		// execute tasks if earliest next task date is reached
		now := tools.GetTimeUnix()
		if runEarliestUnix == 0 || now < runEarliestUnix {
			change_mx.Unlock()
			continue
		}

		// tasks are being executed, reset next date for next run
		runEarliestUnix = 0

		// trigger all tasks that are scheduled and not already running
		// if multiple schedules trigger for a PG function only execute one
		for i, t := range tasks {
			if now >= t.runNextUnix && t.runNextUnix != -1 {
				go runTaskByIndex(i)
			}
		}
		change_mx.Unlock()
	}
}

func runTaskByIndex(taskIndex int) {

	change_mx.Lock()

	if taskIndex >= len(tasks) {
		// index out of bounds
		change_mx.Unlock()
		return
	}
	if tasks[taskIndex].running {
		// block if task was already running
		change_mx.Unlock()
		return
	}
	initCounterPre := initCounter   // store counter value before task execution
	tasks[taskIndex].running = true // set task running state in central task list (block parallel runs)
	t := tasks[taskIndex]           // copy task for execution outside mutex

	change_mx.Unlock()

	var err error
	isSystemTask := t.pgFunctionId == uuid.Nil
	taskType := "system task"
	if !isSystemTask {
		taskType = "function"
	}

	// run task proper and store schedule meta data
	log.Info("scheduler", fmt.Sprintf("started %s '%s' (scheduled for: %s)",
		taskType, t.nameLog, time.Unix(t.runNextUnix, 0)))

	if err := storeTaskDate(t, "attempt"); err != nil {
		log.Error("scheduler", fmt.Sprintf("'%s' failed to update meta data",
			t.nameLog), err)
	}

	if isSystemTask {
		err = t.fn()
	} else {
		err = runPgFunction(t.pgFunctionId)
	}

	if err == nil {
		if err := storeTaskDate(t, "success"); err != nil {
			log.Error("scheduler", fmt.Sprintf("'%s' failed to update meta data", t.nameLog), err)
		} else {
			log.Info("scheduler", fmt.Sprintf("'%s' executed successfully", t.nameLog))
		}
	} else {
		log.Error("scheduler", fmt.Sprintf("'%s' failed to execute", t.nameLog), err)
	}

	// store last successful run time for schedule
	s := t.scheduleIdMap[t.runNextScheduleId]
	s.runLastUnix = tools.GetTimeUnix()
	t.scheduleIdMap[t.runNextScheduleId] = s

	// store next run time & schedule for task
	t.runNextUnix, t.runNextScheduleId = getNextRunScheduleFromTask(t)
	t.running = false

	change_mx.Lock()
	if initCounterPre == initCounter {
		// update task list if it was not re-initialized during execution
		tasks[taskIndex] = t
	}
	change_mx.Unlock()
}

func storeTaskDate(t task, dateContent string) error {

	if dateContent != "attempt" && dateContent != "success" {
		return errors.New("unknown date content")
	}

	if t.pgFunctionId == uuid.Nil {

		// system task
		_, err := db.Pool.Exec(db.Ctx, fmt.Sprintf(`
			UPDATE instance.scheduler
			SET date_%s = $1
			WHERE task_name = $2
		`, dateContent), tools.GetTimeUnix(), t.name)
		return err
	}

	// PG function schedule task
	_, err := db.Pool.Exec(db.Ctx, fmt.Sprintf(`
		UPDATE instance.scheduler
		SET date_%s = $1
		WHERE pg_function_schedule_id = $2
	`, dateContent), tools.GetTimeUnix(), t.runNextScheduleId)
	return err
}

func runPgFunction(pgFunctionId uuid.UUID) error {

	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(db.Ctx)

	modName, fncName, _, err := lookups.GetPgFunctionDetailsById_tx(tx, pgFunctionId)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`SELECT "%s"."%s"()`, modName, fncName)); err != nil {
		return err
	}
	return tx.Commit(db.Ctx)
}

// get unix time and index of task schedule to run next
func getNextRunScheduleFromTask(t task) (int64, uuid.UUID) {

	var getNextRunFromSchedule = func(s schedule) int64 {

		// run without schedule, just once
		if s.intervalType == "once" {
			if s.runLastUnix != 0 {
				return -1
			}
			return tools.GetTimeUnix()
		}

		// simple intervals, just add seconds
		switch s.intervalType {
		case "seconds":
			return s.runLastUnix + s.interval
		case "minutes":
			return s.runLastUnix + (s.interval * 60)
		case "hours":
			return s.runLastUnix + (s.interval * 60 * 60)
		}

		// more complex intervals, add dates and set to target day/time
		tm := time.Unix(s.runLastUnix, 0)

		switch s.intervalType {
		case "days":
			tm = tm.AddDate(0, 0, int(s.interval))
		case "weeks":
			tm = tm.AddDate(0, 0, int(s.interval*7))
		case "months":
			tm = tm.AddDate(0, int(s.interval), 0)
		case "years":
			tm = tm.AddDate(int(s.interval), 0, 0)
		default:
			return 0
		}

		// define target day / month
		targetDay := tm.Day()
		targetMonth := tm.Month()

		switch s.intervalType {
		case "weeks":
			// 6 is highest allowed value (0 = sunday, 6 = saturday)
			if s.atDay <= 6 {
				// add difference between target weekday and current weekday to target day
				targetDay += s.atDay - int(tm.Weekday())
			}
		case "months":
			// set specified day
			targetDay = s.atDay
		case "years":
			// set to month january, adding days as specified (70 days will end up in March)
			targetMonth = 1
			targetDay = s.atDay
		}

		// apply target month/day and time
		tm = time.Date(tm.Year(), targetMonth, targetDay, s.atHour, s.atMinute,
			s.atSecond, 0, tm.Location())

		return tm.Unix()
	}

	var nextRun int64 = -1 // by default, schedule is stopped (-1)
	var nextRunId uuid.UUID = uuid.Nil

	for id, s := range t.scheduleIdMap {
		nextRunSchedule := getNextRunFromSchedule(s)

		// apply schedule if
		// * next planned run is stoppped (-1)
		// * or this schedule is active and earlier than previous schedule
		if nextRun == -1 || (nextRunSchedule != -1 && nextRunSchedule < nextRun) {
			nextRun = nextRunSchedule
			nextRunId = id
		}
	}
	return nextRun, nextRunId
}
