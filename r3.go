package main

import (
	"bufio"
	"context"
	"crypto/tls"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"r3/cache"
	"r3/cluster"
	"r3/config"
	"r3/data/data_image"
	"r3/db"
	"r3/db/embedded"
	"r3/db/initialize"
	"r3/db/upgrade"
	"r3/handler"
	"r3/handler/api"
	"r3/handler/api_auth"
	"r3/handler/cache_download"
	"r3/handler/client_download"
	"r3/handler/csv_download"
	"r3/handler/csv_upload"
	"r3/handler/data_access"
	"r3/handler/data_auth"
	"r3/handler/data_download"
	"r3/handler/data_download_thumb"
	"r3/handler/data_upload"
	"r3/handler/icon_upload"
	"r3/handler/ics_download"
	"r3/handler/license_upload"
	"r3/handler/manifest_download"
	"r3/handler/transfer_export"
	"r3/handler/transfer_import"
	"r3/handler/websocket"
	"r3/log"
	"r3/login"
	"r3/login/login_session"
	"r3/scheduler"
	"r3/tools"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	_ "time/tzdata" // to embed timezone DB

	"github.com/kardianos/service"
)

var (
	// overwritten by build parameters
	appName          string = "REI3"
	appNameShort     string = "R3"
	appVersion       string = "0.1.2.3"
	appVersionClient string = "0.1.2.3"

	// start parameters
	cli struct {
		adminCreate      string
		configFile       string
		debug            bool
		dynamicPort      bool
		imageMagick      string
		http             bool
		open             bool
		run              bool
		serviceName      string
		serviceStart     bool
		serviceStop      bool
		serviceInstall   bool
		serviceUninstall bool
		setData          string
		wwwPath          string
	}

	// embed static web files
	//go:embed www/*
	fsStatic embed.FS

	//go:embed www/images/noPic.png
	fsStaticNoPic []byte
)

type program struct {
	embeddedDbOwned atomic.Bool    // whether this instance has started the embedded database
	logger          service.Logger // logs to the operating system if called as service, otherwise to stdOut
	stopping        atomic.Bool
	webServer       *http.Server
}

func main() {

	// set configuration parameters
	if err := config.SetAppVersion(appVersion, "service"); err != nil {
		fmt.Printf("failed to set app version, %v\n", err)
		return
	}
	if err := config.SetAppVersion(appVersionClient, "fatClient"); err != nil {
		fmt.Printf("failed to set app client version, %v\n", err)
		return
	}
	config.SetAppName(appName, appNameShort)

	// process configuration overwrites from command line
	flag.StringVar(&cli.adminCreate, "newadmin", "", "Create new admin user (username:password), password must not contain spaces or colons")
	flag.StringVar(&cli.configFile, "config", "config.json", "Location of configuration file (combined with -run)")
	flag.BoolVar(&cli.dynamicPort, "dynamicport", false, "Start with a port provided by the operating system (combined with -run)")
	flag.StringVar(&cli.imageMagick, "imagemagick", "", "Alternative location for the ImageMagick convert utility")
	flag.BoolVar(&cli.http, "http", false, "Start with HTTP (not encrypted, for testing/development only, combined with -run)")
	flag.BoolVar(&cli.open, "open", false, fmt.Sprintf("Open URL of %s in default browser (combined with -run)", appName))
	flag.BoolVar(&cli.run, "run", false, fmt.Sprintf("Run %s from within this console (see 'config.json' for configuration)", appName))
	flag.BoolVar(&cli.debug, "debug", false, "Logs all events regardless of configured log level (combined with -run)")
	flag.BoolVar(&cli.serviceInstall, "install", false, fmt.Sprintf("Install %s service", appName))
	flag.StringVar(&cli.serviceName, "servicename", appName, "Specify name of service to manage (to (un)install, start or stop service)")
	flag.BoolVar(&cli.serviceStart, "start", false, fmt.Sprintf("Start %s service", appName))
	flag.BoolVar(&cli.serviceStop, "stop", false, fmt.Sprintf("Stop %s service", appName))
	flag.BoolVar(&cli.serviceUninstall, "uninstall", false, fmt.Sprintf("Uninstall %s service", appName))
	flag.StringVar(&cli.setData, "setdata", "", "Write to config file: Data directory (platform files and database if stand-alone)")
	flag.StringVar(&cli.wwwPath, "wwwpath", "", "(Development) Use web files from given path instead of embedded ones")
	flag.Parse()

	// enable debug mode
	if cli.debug {
		log.SetDebug(true)
	}

	// define service and service logger
	svcDisplay := fmt.Sprintf("%s platform", appName)
	if cli.serviceName != appName {
		svcDisplay = fmt.Sprintf("%s platform (%s)", appName, cli.serviceName)
	}
	svcConfig := &service.Config{
		Name:        strings.ToLower(cli.serviceName),
		DisplayName: svcDisplay,
		Description: fmt.Sprintf("Provides the %s platform components", appName),
	}

	// initialize service
	prg := &program{}

	svc, err := service.New(prg, svcConfig)
	if err != nil {
		fmt.Printf("service could not be created, error: %v\n", err)
		return
	}
	prg.logger, err = svc.Logger(nil)
	if err != nil {
		fmt.Printf("service logger could not be created, error: %v\n", err)
		return
	}

	// listen to global shutdown channel
	go func() {
		<-scheduler.OsExit
		prg.executeAborted(svc, nil)
	}()

	// add shut down in case of SIGTERM (terminal closed)
	if service.Interactive() {
		signal.Notify(scheduler.OsExit, syscall.SIGTERM)
	}

	// get path for executable & change working dir to it
	app, err := os.Executable()
	if err != nil {
		prg.logger.Error(err)
		return
	}
	if err := os.Chdir(filepath.Dir(app)); err != nil {
		prg.logger.Error(err)
		return
	}

	// load configuration from file
	config.SetConfigFilePath(cli.configFile)

	if err := config.LoadFile(); err != nil {
		prg.logger.Errorf("failed to read configuration file, %v", err)
		return
	}

	// apply portable mode settings if enabled
	if config.File.Portable {
		cli.dynamicPort = true
		cli.http = true
		cli.run = true
		cli.open = true
	}

	// print usage info if interactive and no arguments were added
	if !config.File.Portable && service.Interactive() && len(os.Args) == 1 {
		fmt.Printf("Available parameters:\n")
		flag.PrintDefaults()

		fmt.Printf("\n################################################################################\n")
		fmt.Printf("This is the executable of %s, the open low-code platform, v%s\n", appName, appVersion)
		fmt.Printf("Copyright (c) 2019-2024 Gabriel Victor Herbert\n\n")
		fmt.Printf("%s can be installed as service (-install) or run from the console (-run).\n\n", appName)
		fmt.Printf("When %s is running, use any modern browser to access it (port 443 by default).\n\n", appName)
		fmt.Printf("For installation instructions, please refer to the included README file or visit\n")
		fmt.Printf("https://rei3.de/en/docs/admin/ for the full admin documentation.\n")
		fmt.Printf("################################################################################\n\n")

		// wait for user input to keep console open
		fmt.Printf("See above for available parameters. Press enter to return.\n")

		reader := bufio.NewReader(os.Stdin)
		reader.ReadString('\n')
		return
	}

	// other cli arguments
	if cli.serviceInstall {
		if err := svc.Install(); err != nil {
			prg.logger.Error(err)
			return
		}
		prg.logger.Info("service was successfully installed")
		return
	}
	if cli.serviceUninstall {
		if err := svc.Uninstall(); err != nil {
			prg.logger.Error(err)
			return
		}
		prg.logger.Info("service was successfully uninstalled")
		return
	}
	if cli.serviceStart {
		if err := svc.Start(); err != nil {
			prg.logger.Error(err)
			return
		}
		prg.logger.Info("service was successfully started")
		return
	}
	if cli.serviceStop {
		if err := svc.Stop(); err != nil {
			prg.logger.Error(err)
			return
		}
		prg.logger.Info("service was successfully stopped")
		return
	}
	if cli.dynamicPort {
		config.File.Web.Port = 0
	}
	if cli.setData != "" {
		config.File.Paths.Certificates = filepath.Join(cli.setData, "certificates")
		config.File.Paths.EmbeddedDbData = filepath.Join(cli.setData, "database")
		config.File.Paths.Files = filepath.Join(cli.setData, "files")
		config.File.Paths.Temp = filepath.Join(cli.setData, "temp")
		config.File.Paths.Transfer = filepath.Join(cli.setData, "transfer")

		if err := config.WriteFile(); err != nil {
			prg.logger.Errorf("failed to write configuration file, %v", err)
		}
		return
	}

	// main executable can be used to open the app in default browser even if its not started (-open without -run)
	// used for shortcuts in start menu when installed on Windows systems with desktop experience
	// if dynamic port is used, we cannot open app without starting it (port is not known)
	if cli.open && !cli.dynamicPort {
		protocol := "https"
		if cli.http {
			protocol = "http"
		}
		tools.OpenRessource(fmt.Sprintf("%s://localhost:%d", protocol, config.File.Web.Port))
	}

	// interactive, app only starts if to be run from console or when creating an admin user
	if service.Interactive() && !cli.run && cli.adminCreate == "" {
		return
	}

	// Run() blocks until Stop() is called
	if err := svc.Run(); err != nil {
		prg.logger.Error(err)
		return
	}
}

// Start() is called when service is being started
func (prg *program) Start(svc service.Service) error {

	if !service.Interactive() {
		prg.logger.Info("Starting service...")
	} else {
		log.SetOutputCli(true)
	}
	go prg.execute(svc)
	return nil
}

// execute the application logic
func (prg *program) execute(svc service.Service) {

	// start embedded database
	if config.File.Db.Embedded {
		prg.logger.Infof("start embedded database at '%s'", config.File.Paths.EmbeddedDbData)
		embedded.SetPaths()

		if err := embedded.Start(); err != nil {
			prg.executeAborted(svc, fmt.Errorf("failed to start embedded database, %v", err))
			return
		}

		// we own the embedded DB if we can successfully start it
		// otherwise another instance might be running it
		prg.embeddedDbOwned.Store(true)
	}

	// connect to database
	// wait X seconds at first start for database service to become ready
	if err := db.OpenWait(15, config.File.Db); err != nil {
		prg.executeAborted(svc, fmt.Errorf("failed to open database connection, %v", err))
		return
	}

	// check for first database start
	if err := initialize.PrepareDbIfNew(); err != nil {
		prg.executeAborted(svc, fmt.Errorf("failed to initiate database on first start, %v", err))
		return
	}

	// apply configuration from database
	if err := cluster.ConfigChanged(false, true, false); err != nil {
		prg.executeAborted(svc, fmt.Errorf("failed to apply configuration from database, %v", err))
		return
	}

	// store host details in cache (before cluster node startup)
	if err := cache.SetHostnameFromOs(); err != nil {
		prg.executeAborted(svc, fmt.Errorf("failed to load host details, %v", err))
		return
	}

	// process cli commands
	if cli.adminCreate != "" {
		adminInputs := strings.Split(cli.adminCreate, ":")

		if len(adminInputs) != 2 {
			prg.executeAborted(svc, fmt.Errorf("invalid syntax for admin creation, required is username:password"))
		} else {
			if err := login.CreateAdmin(adminInputs[0], adminInputs[1]); err != nil {
				prg.executeAborted(svc, fmt.Errorf("failed to create admin user, %v", err))
			} else {
				prg.logger.Info("successfully created new admin user")
				prg.executeAborted(svc, nil)
			}
		}
		return
	}

	// run automatic database upgrade if required
	if err := upgrade.RunIfRequired(); err != nil {
		prg.executeAborted(svc, fmt.Errorf("failed automatic upgrade of database, %v", err))
		return
	}

	// setup cluster node with shared database
	if err := cluster.StartNode(); err != nil {
		prg.executeAborted(svc, fmt.Errorf("failed to setup cluster node, %v", err))
		return
	}

	// remove login sessions logs for this cluster node (in case they were not removed on shutdown)
	if err := login_session.LogsRemoveForNode(); err != nil {
		prg.logger.Error(err)
	}

	// initialize caches
	// module meta data must be loaded before module schema (informs about what modules to load)
	if err := cache.LoadModuleIdMapMeta(); err != nil {
		prg.executeAborted(svc, fmt.Errorf("failed to initialize module meta cache, %v", err))
		return
	}
	if err := cache.LoadCaptionMapCustom(); err != nil {
		prg.executeAborted(svc, fmt.Errorf("failed to initialize custom caption map cache, %v", err))
		return
	}
	if err := cache.LoadSchema(); err != nil {
		prg.executeAborted(svc, fmt.Errorf("failed to initialize schema cache, %v", err))
		return
	}
	if err := cache.LoadLdapMap(); err != nil {
		prg.executeAborted(svc, fmt.Errorf("failed to initialize LDAP cache, %v", err))
		return
	}
	if err := cache.LoadMailAccountMap(); err != nil {
		prg.executeAborted(svc, fmt.Errorf("failed to initialize mail account cache, %v", err))
		return
	}
	if err := cache.LoadOauthClientMap(); err != nil {
		prg.executeAborted(svc, fmt.Errorf("failed to initialize oauth client cache, %v", err))
		return
	}
	if err := cache.LoadPwaDomainMap(); err != nil {
		prg.executeAborted(svc, fmt.Errorf("failed to initialize PWA domain cache, %v", err))
		return
	}
	if err := cache.LoadSearchDictionaries(); err != nil {
		// failure is not mission critical (in case of no access to DB system tables)
		log.Error("server", "failed to read/update text search dictionaries", err)
	}

	// process token secret for future client authentication from database
	if err := config.ProcessTokenSecret(); err != nil {
		prg.executeAborted(svc, fmt.Errorf("failed to process token secret, %v", err))
		return
	}

	// set unique instance ID if empty
	if err := config.SetInstanceIdIfEmpty(); err != nil {
		prg.executeAborted(svc, fmt.Errorf("failed to set instance ID, %v", err))
		return
	}

	// prepare image processing
	data_image.PrepareProcessing(cli.imageMagick)

	log.Info("server", fmt.Sprintf("is ready to start application (%s)", appVersion))

	// start scheduler (must start after module cache)
	go scheduler.Start()

	// prepare web server
	go websocket.StartBackgroundTasks()

	mux := http.NewServeMux()

	if cli.wwwPath == "" {
		fsStaticWww, err := fs.Sub(fs.FS(fsStatic), "www")
		if err != nil {
			prg.executeAborted(svc, fmt.Errorf("failed to access embedded web file directory, %v", err))
			return
		}
		mux.Handle("/", http.FileServer(http.FS(fsStaticWww)))
	} else {
		mux.Handle("/", http.FileServer(http.Dir(cli.wwwPath)))
	}
	handler.SetNoImage(fsStaticNoPic)

	mux.HandleFunc("/api/", api.Handler)
	mux.HandleFunc("/api/auth", api_auth.Handler)
	mux.HandleFunc("/cache/download/", cache_download.Handler)
	mux.HandleFunc("/csv/download/", csv_download.Handler)
	mux.HandleFunc("/csv/upload", csv_upload.Handler)
	mux.HandleFunc("/client/download/", client_download.Handler)
	mux.HandleFunc("/client/download/config/", client_download.HandlerConfig)
	mux.HandleFunc("/data/download/", data_download.Handler)
	mux.HandleFunc("/data/download/thumb/", data_download_thumb.Handler)
	mux.HandleFunc("/data/upload", data_upload.Handler)
	mux.HandleFunc("/icon/upload", icon_upload.Handler)
	mux.HandleFunc("/ics/download/", ics_download.Handler)
	mux.HandleFunc("/license/upload", license_upload.Handler)
	mux.HandleFunc("/manifests/", manifest_download.Handler)
	mux.HandleFunc("/websocket", websocket.Handler)
	mux.HandleFunc("/export/", transfer_export.Handler)
	mux.HandleFunc("/import", transfer_import.Handler)

	// legacy
	mux.HandleFunc("/data/access", data_access.Handler)
	mux.HandleFunc("/data/auth", data_auth.Handler)

	webServerString := fmt.Sprintf("%s:%d", config.File.Web.Listen, config.File.Web.Port)
	webListener, err := net.Listen("tcp", webServerString)
	if err != nil {
		prg.executeAborted(svc, fmt.Errorf("failed to register listener for HTTP server, %v", err))
		return
	}
	config.File.Web.Port = webListener.Addr().(*net.TCPAddr).Port

	prg.webServer = &http.Server{
		Addr:              webServerString,
		Handler:           mux,
		IdleTimeout:       120 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Info("server", fmt.Sprintf("starting web handlers for '%s'", webServerString))

	// if dynamic port is used we can only now open the app in default browser (port is now known)
	if cli.open && cli.dynamicPort {
		protocol := "https"
		if cli.http {
			protocol = "http"
		}
		tools.OpenRessource(fmt.Sprintf("%s://localhost:%d", protocol, config.File.Web.Port))
	}

	// show interactive user that application is ready for connection
	if service.Interactive() {
		fmt.Printf("Starting web server for '%s'...\n", webServerString)
	}

	// start web server and block routine
	if cli.http {
		if err := prg.webServer.Serve(webListener); err != nil && err != http.ErrServerClosed {
			prg.executeAborted(svc, err)
		}
	} else {
		cache.SetCertPaths(
			filepath.Join(config.File.Paths.Certificates, config.File.Web.Cert),
			filepath.Join(config.File.Paths.Certificates, config.File.Web.Key))

		if err := cache.CheckRenewCert(); err != nil {
			prg.executeAborted(svc, err)
			return
		}

		// PreferServerCipherSuites & CipherSuites are deprecated
		// https://github.com/golang/go/issues/45430
		prg.webServer.TLSConfig = &tls.Config{
			GetCertificate: cache.GetCert,
		}
		switch config.File.Web.TlsMinVersion {
		case "": // prior to 3.8.4, defaults to not apply min. TLS version
		case "1.1":
			prg.webServer.TLSConfig.MinVersion = tls.VersionTLS11
		case "1.2":
			prg.webServer.TLSConfig.MinVersion = tls.VersionTLS12
		case "1.3":
			prg.webServer.TLSConfig.MinVersion = tls.VersionTLS13
		default:
			log.Warning("server", "failed to apply min. TLS version",
				fmt.Errorf("version '%s' is not supported (valid: 1.1, 1.2 or 1.3)", config.File.Web.TlsMinVersion))
		}
		if err := prg.webServer.ServeTLS(webListener, "", ""); err != nil && err != http.ErrServerClosed {
			prg.executeAborted(svc, err)
		}
	}
}

// properly shuts down application, if execution is aborted prematurely
func (prg *program) executeAborted(svc service.Service, err error) {
	if err != nil {
		prg.logger.Error(err)
	}
	if service.Interactive() {
		if err := prg.Stop(svc); err != nil {
			prg.logger.Error(err)
		}
		// in cases like cluster node shutdown, there is no exit signal
		os.Exit(0)
	} else {
		if err := svc.Stop(); err != nil {
			prg.logger.Error(err)
		}
	}
}

// Stop() is also called when service is being shut down
func (prg *program) Stop(svc service.Service) error {

	if !service.Interactive() {
		prg.logger.Info("Stopping service...")
	} else {
		// keep shut down message visible
		fmt.Println("Shutting down...")
		time.Sleep(500 * time.Millisecond)
	}

	if prg.stopping.Load() {
		return nil
	}
	prg.stopping.Store(true)

	// remove login session logs for this cluster node
	if err := login_session.LogsRemoveForNode(); err != nil {
		prg.logger.Error(err)
	}

	// stop scheduler
	scheduler.Stop()

	// stop web server if running
	if prg.webServer != nil {

		ctx, ctxCanc := context.WithTimeout(context.Background(), 5*time.Second)
		defer ctxCanc()

		if err := prg.webServer.Shutdown(ctx); err != nil {
			prg.logger.Error(err)
		}
		log.Info("server", "stopped web handlers")
	}

	// close database connection and deregister cluster node if DB is open
	if db.Pool != nil {
		if err := cluster.StopNode(); err != nil {
			prg.logger.Error(err)
		}
		db.Close()
		log.Info("server", "stopped database handler")
	}

	// stop embedded database if owned
	if prg.embeddedDbOwned.Load() {
		if err := embedded.Stop(); err != nil {
			prg.logger.Error(err)
		}
		log.Info("server", "stopped embedded database")
	}
	return nil
}
