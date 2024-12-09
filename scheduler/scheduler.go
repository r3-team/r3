package scheduler

import (
	"context"
	"errors"
	"fmt"
	"os"
	"r3/backup"
	"r3/bruteforce"
	"r3/cache"
	"r3/cluster"
	"r3/config"
	"r3/data"
	"r3/db"
	"r3/ldap/ldap_import"
	"r3/log"
	"r3/repo"
	"r3/schema"
	"r3/spooler/mail_attach"
	"r3/spooler/mail_receive"
	"r3/spooler/mail_send"
	"r3/spooler/rest_send"
	"r3/tools"
	"r3/transfer"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type task struct {
	name        string // task name
	nameLog     string // task log name
	running     bool   // task running state (block parallel execution)
	runNextUnix int64  // unix time of next task execution time (earliest schedule), -1 if it should not run

	// PG function specific
	pgFunctionId             uuid.UUID                  // ID of PG function to execute
	pgFunctionScheduleIdMap  map[uuid.UUID]taskSchedule // map of PG function schedules by ID
	pgFunctionScheduleIdNext uuid.UUID                  // ID of PG function schedule to run next

	// system task specific
	fn           func() error // system task function to execute
	isSystemTask bool         // system task (as opposed to task from PG function)
	taskSchedule taskSchedule // single schedule for system tasks
}
type taskSchedule struct {
	// states
	id                int64  // schedule ID
	clusterMasterOnly bool   // schedule only to be executed by cluster master (instead of by all nodes)
	interval          int64  // execution interval
	intervalType      string // type of interval (seconds, minutes, hours, days, weeks, months, years, once)
	runLastUnix       int64  // unix time of last execution time of this schedule

	// target day for interval types weeks/months
	atDay int

	// target time for interval types days/weeks/months
	atHour   int
	atMinute int
	atSecond int
}

var (
	change_mx                        = &sync.Mutex{}
	loadTasks                        = true // if true, tasks are reloaded from the database on next run
	loadCounter       int            = 0    // number of times tasks were loaded - used to check whether tasks were reloaded during execution
	nextExecutionUnix int64          = 0    // unix time of next (earliest) task to run
	oneDayInSeconds   int64          = 60 * 60 * 24
	tasks             []task         // all tasks
	OsExit            chan os.Signal = make(chan os.Signal)

	// main loop
	loopInterval                      = time.Second * time.Duration(1)  // loop interval
	loopIntervalStartWait             = time.Second * time.Duration(10) // loop waits at start
	loopStopping          atomic.Bool                                   // loop is stopping
)

func Start() {
	time.Sleep(loopIntervalStartWait)
	log.Info("scheduler", "started")

	for {
		time.Sleep(loopInterval)
		if loopStopping.Load() {
			log.Info("scheduler", "stopped")
			return
		}
		if err := runTasksBySchedule(); err != nil {
			log.Error("scheduler", "failed to start tasks", err)
		}
	}
}
func Stop() {
	loopStopping.Store(true)
	log.Info("scheduler", "stopping")
}

func init() {
	// listen to restart channel for resetting the scheduler state
	go func() {
		for {
			select {
			case <-cluster.SchedulerRestart:
				change_mx.Lock()
				loadTasks = true
				change_mx.Unlock()
			}
		}
	}()
}

// start tasks which schedules are due
func runTasksBySchedule() error {
	change_mx.Lock()
	defer change_mx.Unlock()

	// obtain read locks for import transfers & schema updates
	// tasks should not be started while either is running
	transfer.Import_mx.RLock()
	defer transfer.Import_mx.RUnlock()

	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	if loadTasks {
		if err := load(); err != nil {
			return err
		}
		nextExecutionUnix = 0
	}

	if len(tasks) == 0 {
		return nil
	}

	// get earliest unix time for any task to run
	if nextExecutionUnix == 0 {

		var taskNameNext string
		for _, t := range tasks {

			// task is already running or should not run anymore (-1)
			if t.running || t.runNextUnix == -1 {
				continue
			}

			if nextExecutionUnix == 0 || t.runNextUnix < nextExecutionUnix {
				nextExecutionUnix = t.runNextUnix
				taskNameNext = t.nameLog
			}
		}
		log.Info("scheduler", fmt.Sprintf("will start next task at %s ('%s')",
			time.Unix(nextExecutionUnix, 0), taskNameNext))
	}

	// execute tasks if earliest next task date is reached
	now := tools.GetTimeUnix()
	if nextExecutionUnix != 0 && now >= nextExecutionUnix {

		// tasks are being executed, reset for next run
		nextExecutionUnix = 0

		// trigger all tasks that are scheduled
		// if multiple schedules trigger for a PG function only execute one
		for i, t := range tasks {
			if now >= t.runNextUnix && t.runNextUnix != -1 {
				go runTaskByIndex(i)
			}
		}
	}
	return nil
}

// start task directly (by name if system task or by a PG function schedule)
func runTaskDirectly(systemTaskName string, pgFunctionId uuid.UUID, pgFunctionScheduleId uuid.UUID) {

	change_mx.Lock()
	taskIndexToRun := -1
	if systemTaskName != "" {
		for i, t := range tasks {
			if t.isSystemTask && t.name == systemTaskName {
				taskIndexToRun = i
				break
			}
		}
	} else {
		for i, t := range tasks {
			if t.isSystemTask || t.pgFunctionId != pgFunctionId {
				continue
			}

			// set specific schedule to execute
			if _, exists := t.pgFunctionScheduleIdMap[pgFunctionScheduleId]; exists {
				tasks[i].pgFunctionScheduleIdNext = pgFunctionScheduleId
				taskIndexToRun = i
			}
		}
	}
	change_mx.Unlock()

	// if task was found, run it
	if taskIndexToRun != -1 {
		go runTaskByIndex(taskIndexToRun)
	}
}

// start task by its index in scheduler task list
func runTaskByIndex(taskIndex int) {

	// store counter value before task, to check whether tasks were reloaded during
	change_mx.Lock()
	loadCounterPre := loadCounter

	// skip, if task is already running
	if tasks[taskIndex].running {
		change_mx.Unlock()
		return
	}
	tasks[taskIndex].running = true
	t := tasks[taskIndex]

	change_mx.Unlock()

	// run task and store schedule meta data
	var err error

	log.Info("scheduler", fmt.Sprintf("task '%s' started (scheduled for: %s)",
		t.nameLog, time.Unix(t.runNextUnix, 0)))

	if err := storeTaskDate(t, "attempt"); err != nil {
		log.Error("scheduler", fmt.Sprintf("task '%s' failed to update its meta data",
			t.nameLog), err)
	}

	if t.isSystemTask {
		err = t.fn()
	} else {
		err = runPgFunction(t.pgFunctionId)
	}

	if err == nil {
		if err := storeTaskDate(t, "success"); err != nil {
			log.Error("scheduler", fmt.Sprintf("task '%s' failed to update its meta data", t.nameLog), err)
		} else {
			log.Info("scheduler", fmt.Sprintf("task '%s' executed successfully", t.nameLog))
		}
	} else {
		log.Error("scheduler", fmt.Sprintf("task '%s' failed to execute", t.nameLog), err)
	}

	// store last successful run time for schedule and set next run time
	if t.isSystemTask {
		t.taskSchedule.runLastUnix = tools.GetTimeUnix()
		t.runNextUnix = getNextRunFromSchedule(t.taskSchedule)
	} else {
		s := t.pgFunctionScheduleIdMap[t.pgFunctionScheduleIdNext]
		s.runLastUnix = tools.GetTimeUnix()
		t.pgFunctionScheduleIdMap[t.pgFunctionScheduleIdNext] = s
		t.runNextUnix, t.pgFunctionScheduleIdNext = getNextRunScheduleFromTask(t)
	}
	t.running = false

	// update task list if it was not reloaded during execution
	change_mx.Lock()
	if loadCounterPre == loadCounter {
		tasks[taskIndex] = t
	}
	change_mx.Unlock()
}

func load() error {
	log.Info("scheduler", "is updating its configuration")
	tasks = nil

	// get system tasks and their states
	rows, err := db.Pool.Query(context.Background(), `
		SELECT t.name, t.embedded_only, t.interval_seconds,
			t.cluster_master_only, s.id, s.date_attempt, ns.date_attempt
		FROM instance.task AS t
		INNER JOIN instance.schedule AS s
			ON s.task_name = t.name
		LEFT JOIN instance_cluster.node_schedule AS ns
			ON  ns.schedule_id = s.id
			AND ns.node_id     = $1
		WHERE t.active
	`, cache.GetNodeId())
	if err != nil {
		return err
	}

	for rows.Next() {
		var t task
		var s taskSchedule
		var embeddedOnly bool
		var runLastUnixNode pgtype.Int8

		if err := rows.Scan(&t.name, &embeddedOnly, &s.interval,
			&s.clusterMasterOnly, &s.id, &s.runLastUnix, &runLastUnixNode); err != nil {

			return err
		}

		if s.clusterMasterOnly && !cache.GetIsClusterMaster() {
			continue
		}
		if embeddedOnly && !config.File.Db.Embedded {
			continue
		}

		// for tasks that all nodes have to execute, get node specific schedules
		if !s.clusterMasterOnly {
			if runLastUnixNode.Valid {
				s.runLastUnix = runLastUnixNode.Int64
			} else {
				s.runLastUnix = 0 // never executed before
			}
		}

		// system tasks currently have a single schedule, every x seconds
		s.intervalType = "seconds"

		// system task schedule never ran, use now as starting point
		// update check should however run immediately (in case of important security update)
		if s.runLastUnix == 0 && t.name != "updateCheck" {
			s.runLastUnix = tools.GetTimeUnix()
		}

		t.taskSchedule = s
		t.isSystemTask = true
		t.runNextUnix = getNextRunFromSchedule(s)

		switch t.name {
		case "adminMails":
			t.nameLog = "Admin notification mails"
			t.fn = adminMails
		case "backupRun":
			t.nameLog = "Integrated full backups"
			t.fn = backup.Run
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
		case "cleanupMailTraffic":
			t.nameLog = "Cleanup of mail traffic entries"
			t.fn = cleanupMailTraffic
		case "clusterCheckIn":
			t.nameLog = "Cluster node check-in to database"
			t.fn = cluster.CheckInNode
		case "dbOptimize":
			t.nameLog = "Database optimization"
			t.fn = dbOptimize
		case "clusterProcessEvents":
			t.nameLog = "Cluster event processing"
			t.fn = clusterProcessEvents
		case "httpCertRenew":
			t.nameLog = "Reload of updated HTTP certificate"
			t.fn = cache.CheckRenewCert
		case "importLdapLogins":
			t.nameLog = "Import from LDAP connections"
			t.fn = ldap_import.RunAll
		case "mailAttach":
			t.nameLog = "Email attachment transfer"
			t.fn = mail_attach.DoAll
		case "mailRetrieve":
			t.nameLog = "Email retrieval"
			t.fn = mail_receive.DoAll
		case "mailSend":
			t.nameLog = "Email dispatch"
			t.fn = mail_send.DoAll
		case "repoCheck":
			t.nameLog = "Check for updates from repository"
			t.fn = repo.Update
		case "restExecute":
			t.nameLog = "REST call execution"
			t.fn = rest_send.DoAll
		case "systemMsgMaintenance":
			t.nameLog = "Set maintenance mode after system message"
			t.fn = systemMsgMaintenance
		case "updateCheck":
			t.nameLog = "Check for platform updates from official website"
			t.fn = updateCheck
		default:
			return fmt.Errorf("unknown task '%s'", t.name)
		}
		tasks = append(tasks, t)
	}
	rows.Close()

	// get PG function schedules (only cluster master)
	if cache.GetIsClusterMaster() {
		pgFunctionIdMapTasks := make(map[uuid.UUID]task)

		rows, err = db.Pool.Query(context.Background(), `
			SELECT f.name, fs.pg_function_id, fs.id, fs.at_hour, fs.at_minute,
				fs.at_second, fs.at_day, fs.interval_type, fs.interval_value,
				s.id, s.date_attempt
			FROM app.pg_function AS f
			INNER JOIN app.pg_function_schedule AS fs ON fs.pg_function_id = f.id
			INNER JOIN instance.schedule AS s
				ON s.pg_function_schedule_id = fs.id
				AND (
					s.date_attempt = 0
					OR fs.interval_type <> 'once'
				)
		`)
		if err != nil {
			return err
		}

		for rows.Next() {
			var t task
			var s taskSchedule
			var pgFunctionScheduleId uuid.UUID

			t.pgFunctionScheduleIdMap = make(map[uuid.UUID]taskSchedule)

			if err := rows.Scan(&t.name, &t.pgFunctionId, &pgFunctionScheduleId,
				&s.atHour, &s.atMinute, &s.atSecond, &s.atDay, &s.intervalType,
				&s.interval, &s.id, &s.runLastUnix); err != nil {

				return err
			}
			t.nameLog = t.name

			if _, exists := pgFunctionIdMapTasks[t.pgFunctionId]; exists {
				t = pgFunctionIdMapTasks[t.pgFunctionId]
			}

			t.pgFunctionScheduleIdMap[pgFunctionScheduleId] = s
			pgFunctionIdMapTasks[t.pgFunctionId] = t
		}
		for _, t := range pgFunctionIdMapTasks {
			t.runNextUnix, t.pgFunctionScheduleIdNext = getNextRunScheduleFromTask(t)
			tasks = append(tasks, t)
		}
	}
	rows.Close()

	loadTasks = false
	loadCounter++
	return nil
}

// helpers
func runPgFunction(pgFunctionId uuid.UUID) error {
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutPgFunc)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	modName, fncName, _, _, err := schema.GetPgFunctionDetailsById_tx(ctx, tx, pgFunctionId)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf(`SELECT "%s"."%s"()`, modName, fncName)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// get unix time and index of task schedule to run next
func getNextRunScheduleFromTask(t task) (int64, uuid.UUID) {

	var nextRun int64 = -1 // by default, schedule is stopped (-1)
	var nextRunId uuid.UUID = uuid.Nil

	for id, s := range t.pgFunctionScheduleIdMap {
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

func getNextRunFromSchedule(s taskSchedule) int64 {

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
	// as no timezone is defined, tm will be in local time, which will affect all date operations
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

	// overwrite invalid inputs
	s.atDay = schema.GetValidAtDay(s.intervalType, s.atDay)

	switch s.intervalType {
	case "weeks":
		// add difference between target weekday and last ran weekday to target day
		targetDay += s.atDay - int(tm.Weekday())
	case "months":
		// set specified day
		targetDay = s.atDay
	case "years":
		// set to month january, adding days as specified (70 days will end up in March)
		targetDay = s.atDay
		targetMonth = 1
	}

	// apply target month/day and time at local time
	tm = time.Date(tm.Year(), targetMonth, targetDay, s.atHour, s.atMinute,
		s.atSecond, 0, tm.Location())

	return tm.Unix()
}

func storeTaskDate(t task, dateContent string) error {

	if dateContent != "attempt" && dateContent != "success" {
		return errors.New("unknown date content")
	}

	// system task
	if t.isSystemTask {
		now := tools.GetTimeUnix()

		if t.taskSchedule.clusterMasterOnly {
			// store cluster master schedule meta globally
			_, err := db.Pool.Exec(context.Background(), fmt.Sprintf(`
				UPDATE instance.schedule
				SET date_%s = $1
				WHERE id = $2
			`, dateContent), tools.GetTimeUnix(), t.taskSchedule.id)
			return err
		} else {
			// store node schedule meta independently
			// insert is always 'attempt', while update can be either
			_, err := db.Pool.Exec(context.Background(), fmt.Sprintf(`
				INSERT INTO instance_cluster.node_schedule
					(node_id, schedule_id, date_attempt, date_success)
				VALUES ($1,$2,$3,0)
				ON CONFLICT (node_id,schedule_id) DO UPDATE
					SET date_%s = $4
			`, dateContent), cache.GetNodeId(), t.taskSchedule.id, now, now)
			return err
		}
	}

	// PG function schedule task, schedule meta always stored globally
	_, err := db.Pool.Exec(context.Background(), fmt.Sprintf(`
		UPDATE instance.schedule
		SET date_%s = $1
		WHERE id = $2
	`, dateContent), tools.GetTimeUnix(), t.pgFunctionScheduleIdMap[t.pgFunctionScheduleIdNext].id)
	return err
}
