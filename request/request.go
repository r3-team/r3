package request

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"r3/cache"
	"r3/cluster"
	"r3/config"
	"r3/db"
	"r3/handler"
	"r3/ldap"
	"r3/log"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

// executes a websocket transaction with multiple requests within a single DB transaction
func ExecTransaction(ctx context.Context, address string, loginId int64, isAdmin bool, device types.WebsocketClientDevice,
	isNoAuth bool, reqTrans types.RequestTransaction, clearDbCache bool) ([]types.Response, error) {

	responses := make([]types.Response, 0)

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Error("websocket", "cannot begin transaction", err)
		return responses, errors.New(handler.ErrGeneral)
	}
	defer tx.Rollback(ctx)

	if clearDbCache {
		if err := tx.Conn().DeallocateAll(ctx); err != nil {
			log.Error("websocket", "failed to deallocate DB connection", err)
			return responses, err
		}
	}

	// set session parameters, used by system functions such as instance.get_user_id()
	if err := db.SetSessionConfig_tx(ctx, tx, loginId); err != nil {

		log.Error("websocket", fmt.Sprintf("TRANSACTION %d, transaction config failure (login ID %d)",
			reqTrans.TransactionNr, loginId), err)

		return responses, err
	}

	// work through requests
	for _, req := range reqTrans.Requests {

		log.Info("websocket", fmt.Sprintf("TRANSACTION %d, %s %s, payload: %s",
			reqTrans.TransactionNr, req.Action, req.Ressource, req.Payload))

		payload, err := Exec_tx(ctx, tx, address, loginId, isAdmin, device, isNoAuth, req.Ressource, req.Action, req.Payload)
		if err != nil {
			returnErr, isExpected := handler.ConvertToErrCode(err, !isAdmin)
			if !isExpected {
				log.Warning("websocket", fmt.Sprintf("TRANSACTION %d, request %s %s failure (login ID %d)",
					reqTrans.TransactionNr, req.Ressource, req.Action, loginId), err)
			}
			return responses, returnErr
		}

		var res types.Response
		res.Payload, err = json.Marshal(payload)
		if err != nil {
			return responses, err
		}
		responses = append(responses, res)
	}

	if err := tx.Commit(ctx); err != nil {
		returnErr, isExpected := handler.ConvertToErrCode(err, !isAdmin)
		if !isExpected {
			log.Warning("websocket", fmt.Sprintf("TRANSACTION %d, commit failure (login ID %d)",
				reqTrans.TransactionNr, loginId), err)
		}
		return responses, returnErr
	}
	return responses, nil
}

func Exec_tx(ctx context.Context, tx pgx.Tx, address string, loginId int64, isAdmin bool,
	device types.WebsocketClientDevice, isNoAuth bool, ressource string, action string,
	reqJson json.RawMessage) (interface{}, error) {

	// public requests: accessible to all
	switch ressource {
	case "public":
		switch action {
		case "get":
			return PublicGet()
		}
	}

	if loginId == 0 {
		return nil, errors.New(handler.ErrUnauthorized)
	}

	// authorized requests: fat-client
	if device == types.WebsocketClientDeviceFatClient {
		switch ressource {
		case "clientApp":
			switch action {
			case "getBuild": // current client app build
				return config.GetAppVersionClient().Build, nil
			}
		case "clientEvent":
			switch action {
			case "exec":
				return clientEventExecFatClient_tx(ctx, tx, reqJson, loginId, address)
			case "get":
				return clientEventGetFatClient_tx(ctx, tx, loginId)
			}
		}
		return nil, errors.New(handler.ErrUnauthorized)
	}

	// authorized requests: non-admin
	switch ressource {
	case "data":
		switch action {
		case "del":
			return DataDel_tx(ctx, tx, reqJson, loginId)
		case "get":
			return DataGet_tx(ctx, tx, reqJson, loginId)
		case "getKeys":
			return DataGetKeys_tx(ctx, tx, reqJson, loginId)
		case "getLog":
			return DataLogGet_tx(ctx, tx, reqJson, loginId)
		case "set":
			return DataSet_tx(ctx, tx, reqJson, loginId)
		case "setKeys":
			return DataSetKeys_tx(ctx, tx, reqJson)
		}
	case "event":
		switch action {
		case "clientEventsChanged":
			return eventClientEventsChanged(loginId, address)
		case "filesCopied":
			return eventFilesCopied(reqJson, loginId, address)
		case "fileRequested":
			return eventFileRequested(ctx, reqJson, loginId, address)
		case "keystrokesRequested":
			return eventKeystrokesRequested(reqJson, loginId, address)
		}
	case "feedback":
		switch action {
		case "send":
			return FeedbackSend(reqJson)
		}
	case "file":
		switch action {
		case "paste":
			return filesPaste_tx(ctx, tx, reqJson, loginId)
		}
	case "login":
		switch action {
		case "getNames":
			return LoginGetNames_tx(ctx, tx, reqJson)
		case "delTokenFixed":
			return LoginDelTokenFixed_tx(ctx, tx, reqJson, loginId)
		case "getTokensFixed":
			return LoginGetTokensFixed_tx(ctx, tx, loginId)
		case "setTokenFixed":
			return LoginSetTokenFixed_tx(ctx, tx, reqJson, loginId)
		}
	case "loginClientEvent":
		switch action {
		case "del":
			return loginClientEventDel_tx(ctx, tx, reqJson, loginId)
		case "get":
			return loginClientEventGet_tx(ctx, tx, loginId)
		case "set":
			return loginClientEventSet_tx(ctx, tx, reqJson, loginId)
		}
	case "loginKeys":
		switch action {
		case "getPublic":
			return LoginKeysGetPublic(ctx, reqJson)
		case "reset":
			return LoginKeysReset_tx(ctx, tx, loginId)
		case "store":
			return LoginKeysStore_tx(ctx, tx, reqJson, loginId)
		case "storePrivate":
			return LoginKeysStorePrivate_tx(ctx, tx, reqJson, loginId)
		}
	case "loginPassword":
		switch action {
		case "set":
			if isNoAuth {
				return nil, errors.New(handler.ErrUnauthorized)
			}
			return loginPasswortSet_tx(ctx, tx, reqJson, loginId)
		}
	case "loginSetting":
		switch action {
		case "get":
			return LoginSettingsGet_tx(ctx, tx, loginId)
		case "set":
			if isNoAuth {
				return nil, errors.New(handler.ErrUnauthorized)
			}
			return LoginSettingsSet_tx(ctx, tx, reqJson, loginId)
		}
	case "loginWidgetGroups":
		switch action {
		case "get":
			return LoginWidgetGroupsGet_tx(ctx, tx, loginId)
		case "set":
			return LoginWidgetGroupsSet_tx(ctx, tx, reqJson, loginId)
		}
	case "lookup":
		switch action {
		case "get":
			return lookupGet_tx(ctx, tx, reqJson, loginId)
		}
	case "pgFunction":
		switch action {
		case "exec": // user may exec non-trigger backend function, available to frontend
			return PgFunctionExec_tx(ctx, tx, reqJson, true)
		}
	}

	// authorized requests: admin
	if !isAdmin {
		return nil, errors.New(handler.ErrUnauthorized)
	}

	switch ressource {
	case "api":
		switch action {
		case "copy":
			return ApiCopy_tx(ctx, tx, reqJson)
		case "del":
			return ApiDel_tx(ctx, tx, reqJson)
		case "set":
			return ApiSet_tx(ctx, tx, reqJson)
		}
	case "article":
		switch action {
		case "assign":
			return ArticleAssign_tx(ctx, tx, reqJson)
		case "del":
			return ArticleDel_tx(ctx, tx, reqJson)
		case "set":
			return ArticleSet_tx(ctx, tx, reqJson)
		}
	case "attribute":
		switch action {
		case "del":
			return AttributeDel_tx(ctx, tx, reqJson)
		case "delCheck":
			return AttributeDelCheck_tx(ctx, tx, reqJson)
		case "set":
			return AttributeSet_tx(ctx, tx, reqJson)
		}
	case "backup":
		switch action {
		case "get":
			return BackupGet()
		}
	case "bruteforce":
		switch action {
		case "get":
			return BruteforceGet(reqJson)
		}
	case "captionMap":
		switch action {
		case "get":
			return CaptionMapGet_tx(ctx, tx, reqJson)
		case "setOne":
			return CaptionMapSetOne_tx(ctx, tx, reqJson)
		}
	case "clientEvent":
		switch action {
		case "del":
			return clientEventDel_tx(ctx, tx, reqJson)
		case "set":
			return clientEventSet_tx(ctx, tx, reqJson)
		}
	case "collection":
		switch action {
		case "del":
			return CollectionDel_tx(ctx, tx, reqJson)
		case "set":
			return CollectionSet_tx(ctx, tx, reqJson)
		}
	case "config":
		switch action {
		case "get":
			return ConfigGet()
		case "set":
			return ConfigSet_tx(ctx, tx, reqJson)
		}
	case "cluster":
		switch action {
		case "delNode":
			return ClusterNodeDel_tx(ctx, tx, reqJson)
		case "getNodes":
			return ClusterNodesGet(ctx)
		case "setNode":
			return ClusterNodeSet_tx(ctx, tx, reqJson)
		case "shutdownNode":
			return ClusterNodeShutdown(reqJson)
		}
	case "dataSql":
		switch action {
		case "get":
			return DataSqlGet_tx(ctx, tx, reqJson, loginId)
		}
	case "field":
		switch action {
		case "del":
			return FieldDel_tx(ctx, tx, reqJson)
		}
	case "file":
		switch action {
		case "get":
			return FileGet_tx(ctx, tx)
		case "restore":
			return FileRestore_tx(ctx, tx, reqJson)
		}
	case "form":
		switch action {
		case "copy":
			return FormCopy_tx(ctx, tx, reqJson)
		case "del":
			return FormDel_tx(ctx, tx, reqJson)
		case "set":
			return FormSet_tx(ctx, tx, reqJson)
		}
	case "icon":
		switch action {
		case "del":
			return IconDel_tx(ctx, tx, reqJson)
		case "setName":
			return IconSetName_tx(ctx, tx, reqJson)
		}
	case "jsFunction":
		switch action {
		case "del":
			return JsFunctionDel_tx(ctx, tx, reqJson)
		case "set":
			return JsFunctionSet_tx(ctx, tx, reqJson)
		}
	case "key":
		switch action {
		case "create":
			return KeyCreate(reqJson)
		}
	case "ldap":
		switch action {
		case "check":
			return LdapCheck(reqJson)
		case "del":
			return LdapDel_tx(ctx, tx, reqJson)
		case "get":
			return LdapGet_tx(ctx, tx)
		case "import":
			return LdapImport(reqJson)
		case "reload":
			return nil, ldap.UpdateCache()
		case "set":
			return LdapSet_tx(ctx, tx, reqJson)
		}
	case "license":
		switch action {
		case "del":
			return LicenseDel_tx(ctx, tx)
		case "get":
			return config.GetLicense(), nil
		}
	case "log":
		switch action {
		case "get":
			return LogGet_tx(ctx, tx, reqJson)
		}
	case "login":
		switch action {
		case "del":
			return LoginDel_tx(ctx, tx, reqJson)
		case "get":
			return LoginGet_tx(ctx, tx, reqJson)
		case "getMembers":
			return LoginGetMembers_tx(ctx, tx, reqJson)
		case "getRecords":
			return LoginGetRecords_tx(ctx, tx, reqJson)
		case "kick":
			return LoginKick(reqJson)
		case "reauth":
			return LoginReauth(reqJson)
		case "reauthAll":
			return LoginReauthAll()
		case "resetTotp":
			return LoginResetTotp_tx(ctx, tx, reqJson)
		case "set":
			return LoginSet_tx(ctx, tx, reqJson)
		case "setMembers":
			return LoginSetMembers_tx(ctx, tx, reqJson)
		}
	case "loginForm":
		switch action {
		case "del":
			return LoginFormDel_tx(ctx, tx, reqJson)
		case "set":
			return LoginFormSet_tx(ctx, tx, reqJson)
		}
	case "loginSession":
		switch action {
		case "get":
			return LoginSessionsGet_tx(ctx, tx, reqJson)
		case "getConcurrent":
			return LoginSessionConcurrentGet_tx(ctx, tx)
		}
	case "loginTemplate":
		switch action {
		case "del":
			return LoginTemplateDel_tx(ctx, tx, reqJson)
		case "get":
			return LoginTemplateGet_tx(ctx, tx, reqJson)
		case "set":
			return LoginTemplateSet_tx(ctx, tx, reqJson)
		}
	case "mailAccount":
		switch action {
		case "del":
			return MailAccountDel_tx(ctx, tx, reqJson)
		case "get":
			return MailAccountGet()
		case "reload":
			return MailAccountReload()
		case "set":
			return MailAccountSet_tx(ctx, tx, reqJson)
		case "test":
			return MailAccountTest_tx(ctx, tx, reqJson)
		}
	case "mailSpooler":
		switch action {
		case "del":
			return MailSpoolerDel_tx(ctx, tx, reqJson)
		case "get":
			return MailSpoolerGet_tx(ctx, tx, reqJson)
		case "reset":
			return MailSpoolerReset_tx(ctx, tx, reqJson)
		}
	case "mailTraffic":
		switch action {
		case "get":
			return MailTrafficGet_tx(ctx, tx, reqJson)
		}
	case "menu":
		switch action {
		case "copy":
			return MenuCopy_tx(ctx, tx, reqJson)
		case "del":
			return MenuDel_tx(ctx, tx, reqJson)
		case "set":
			return MenuSet_tx(ctx, tx, reqJson)
		}
	case "module":
		switch action {
		case "checkChange":
			return ModuleCheckChange(reqJson)
		case "del":
			return ModuleDel_tx(ctx, tx, reqJson)
		case "set":
			return ModuleSet_tx(ctx, tx, reqJson)
		}
	case "moduleMeta":
		switch action {
		case "setLanguagesCustom":
			return ModuleMetaSetLanguagesCustom_tx(ctx, tx, reqJson)
		case "setOptions":
			return ModuleMetaSetOptions_tx(ctx, tx, reqJson)
		}
	case "oauthClient":
		switch action {
		case "del":
			return OauthClientDel_tx(ctx, tx, reqJson)
		case "get":
			return OauthClientGet()
		case "reload":
			return OauthClientReload()
		case "set":
			return OauthClientSet_tx(ctx, tx, reqJson)
		}
	case "package":
		switch action {
		case "install":
			return PackageInstall()
		}
	case "pgFunction":
		switch action {
		case "del":
			return PgFunctionDel_tx(ctx, tx, reqJson)
		case "execAny": // admin may exec any non-trigger backend function
			return PgFunctionExec_tx(ctx, tx, reqJson, false)
		case "set":
			return PgFunctionSet_tx(ctx, tx, reqJson)
		}
	case "pgIndex":
		switch action {
		case "del":
			return PgIndexDel_tx(ctx, tx, reqJson)
		case "set":
			return PgIndexSet_tx(ctx, tx, reqJson)
		}
	case "pgTrigger":
		switch action {
		case "del":
			return PgTriggerDel_tx(ctx, tx, reqJson)
		case "set":
			return PgTriggerSet_tx(ctx, tx, reqJson)
		}
	case "preset":
		switch action {
		case "del":
			return PresetDel_tx(ctx, tx, reqJson)
		case "set":
			return PresetSet_tx(ctx, tx, reqJson)
		}
	case "pwaDomain":
		switch action {
		case "reset":
			return nil, cache.LoadPwaDomainMap()
		case "set":
			return PwaDomainSet_tx(ctx, tx, reqJson)
		}
	case "relation":
		switch action {
		case "del":
			return RelationDel_tx(ctx, tx, reqJson)
		case "preview":
			return RelationPreview_tx(ctx, tx, reqJson)
		case "set":
			return RelationSet_tx(ctx, tx, reqJson)
		}
	case "repoModule":
		switch action {
		case "get":
			return RepoModuleGet_tx(ctx, tx, reqJson)
		case "install":
			return RepoModuleInstall(reqJson)
		case "installAll":
			return RepoModuleInstallAll()
		case "update":
			return RepoModuleUpdate()
		}
	case "role":
		switch action {
		case "del":
			return RoleDel_tx(ctx, tx, reqJson)
		case "set":
			return RoleSet_tx(ctx, tx, reqJson)
		}
	case "scheduler":
		switch action {
		case "get":
			return schedulersGet_tx(ctx, tx)
		}
	case "schema":
		switch action {
		case "check":
			return SchemaCheck_tx(ctx, tx, reqJson)
		case "reload":
			return SchemaReload(reqJson)
		}
	case "task":
		switch action {
		case "informChanged":
			return nil, cluster.TasksChanged(true)
		case "run":
			return TaskRun_tx(ctx, tx, reqJson)
		case "set":
			return TaskSet_tx(ctx, tx, reqJson)
		}
	case "transfer":
		switch action {
		case "addVersion":
			return TransferAddVersion_tx(ctx, tx, reqJson)
		case "storeExportKey":
			return TransferStoreExportKey(reqJson)
		}
	case "variable":
		switch action {
		case "del":
			return VariableDel_tx(ctx, tx, reqJson)
		case "set":
			return VariableSet_tx(ctx, tx, reqJson)
		}
	case "widget":
		switch action {
		case "del":
			return WidgetDel_tx(ctx, tx, reqJson)
		case "set":
			return WidgetSet_tx(ctx, tx, reqJson)
		}
	}
	return nil, fmt.Errorf("unknown ressource or action")
}
