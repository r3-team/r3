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
	"r3/repo"
	"r3/request/request_login"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

// executes a websocket transaction with multiple requests within a single DB transaction
func ExecTransaction(ctx context.Context, address string, loginId int64, isAdmin bool, device types.WebsocketClientDevice,
	isNoAuth bool, reqTrans types.RequestTransaction, clearDbCache bool) ([]types.Response, error) {

	var tx pgx.Tx
	var err error

	if !reqTrans.NoDbTx {
		tx, err = db.Pool.Begin(ctx)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback(ctx)

		if clearDbCache {
			if err := tx.Conn().DeallocateAll(ctx); err != nil {
				return nil, err
			}
		}

		if err := db.SetSessionConfig_tx(ctx, tx, loginId); err != nil {
			return nil, err
		}
	}

	// execute and create response for each request
	responses := make([]types.Response, 0)
	for _, req := range reqTrans.Requests {
		log.Info(log.ContextWebsocket, fmt.Sprintf("TRANSACTION %d, %s %s, payload: %s", reqTrans.TransactionNr, req.Action, req.Ressource, req.Payload))

		payload, err := Exec_tx(ctx, tx, address, loginId, isAdmin, device, isNoAuth, req.Ressource, req.Action, req.Payload)
		if err != nil {
			return nil, err
		}

		var res types.Response
		res.Payload, err = json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		responses = append(responses, res)
	}

	if !reqTrans.NoDbTx {
		return responses, tx.Commit(ctx)
	}
	return responses, nil
}

func Exec_tx(ctx context.Context, tx pgx.Tx, address string, loginId int64, isAdmin bool, device types.WebsocketClientDevice,
	isNoAuth bool, ressource string, action string, reqJson json.RawMessage) (any, error) {

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
		case "getRecordTitles":
			return DataGetRecordTitles_tx(ctx, tx, reqJson, loginId)
		case "set":
			return DataSet_tx(ctx, tx, reqJson, loginId)
		case "setKeys":
			return DataSetKeys_tx(ctx, tx, reqJson)
		}
	case "doc":
		switch action {
		case "create":
			return DocCreate(ctx, reqJson, loginId)
		}
	case "event":
		switch action {
		case "clientEventsChanged":
			return eventClientEventsChanged_tx(ctx, tx, loginId, address)
		case "filesCopied":
			return eventFilesCopied_tx(ctx, tx, reqJson, loginId, address)
		case "fileRequested":
			return eventFileRequested_tx(ctx, tx, reqJson, loginId, address)
		case "keystrokesRequested":
			return eventKeystrokesRequested_tx(ctx, tx, reqJson, loginId, address)
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
			return request_login.GetNames_tx(ctx, tx, reqJson)
		case "delTokenFixed":
			return request_login.DelTokenFixed_tx(ctx, tx, reqJson, loginId)
		case "getTokensFixed":
			return request_login.GetTokensFixed_tx(ctx, tx, loginId)
		case "setTokenFixed":
			return request_login.SetTokenFixed_tx(ctx, tx, reqJson, loginId)
		}
	case "loginClientEvent":
		switch action {
		case "del":
			return request_login.ClientEventDel_tx(ctx, tx, reqJson, loginId)
		case "get":
			return request_login.ClientEventGet_tx(ctx, tx, loginId)
		case "set":
			return request_login.ClientEventSet_tx(ctx, tx, reqJson, loginId)
		}
	case "loginFavorites":
		switch action {
		case "add":
			if isNoAuth {
				return nil, errors.New(handler.ErrUnauthorized)
			}
			return request_login.AddFavorites_tx(ctx, tx, reqJson, loginId)
		case "get":
			return request_login.GetFavorites_tx(ctx, tx, reqJson, loginId, isNoAuth)
		case "set":
			if isNoAuth {
				return nil, errors.New(handler.ErrUnauthorized)
			}
			return request_login.SetFavorites_tx(ctx, tx, reqJson, loginId)
		}
	case "loginKeys":
		switch action {
		case "getPublic":
			return request_login.KeysGetPublic_tx(ctx, tx, reqJson)
		case "reset":
			return request_login.KeysReset_tx(ctx, tx, loginId)
		case "store":
			return request_login.KeysStore_tx(ctx, tx, reqJson, loginId)
		case "storePrivate":
			return request_login.KeysStorePrivate_tx(ctx, tx, reqJson, loginId)
		}
	case "loginOptions":
		switch action {
		case "del":
			if isNoAuth {
				return nil, errors.New(handler.ErrUnauthorized)
			}
			return request_login.OptionsDel_tx(ctx, tx, loginId)
		case "get":
			return request_login.OptionsGet_tx(ctx, tx, reqJson, loginId, isNoAuth)
		case "set":
			if isNoAuth {
				return nil, errors.New(handler.ErrUnauthorized)
			}
			return request_login.OptionsSet_tx(ctx, tx, reqJson, loginId)
		}
	case "loginPassword":
		switch action {
		case "set":
			if isNoAuth {
				return nil, errors.New(handler.ErrUnauthorized)
			}
			return request_login.PasswortSet_tx(ctx, tx, reqJson, loginId)
		}
	case "loginSetting":
		switch action {
		case "get":
			return request_login.SettingsGet_tx(ctx, tx, loginId)
		case "set":
			if isNoAuth {
				return nil, errors.New(handler.ErrUnauthorized)
			}
			return request_login.SettingsSet_tx(ctx, tx, reqJson, loginId)
		}
	case "loginWidgetGroups":
		switch action {
		case "get":
			return request_login.WidgetGroupsGet_tx(ctx, tx, loginId)
		case "set":
			return request_login.WidgetGroupsSet_tx(ctx, tx, reqJson, loginId)
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
			return ClusterNodesGet_tx(ctx, tx)
		case "setNode":
			return ClusterNodeSet_tx(ctx, tx, reqJson)
		case "shutdownNode":
			return ClusterNodeShutdown_tx(ctx, tx, reqJson)
		}
	case "dataSql":
		switch action {
		case "get":
			return DataSqlGet_tx(ctx, tx, reqJson, loginId)
		}
	case "doc":
		switch action {
		case "copy":
			return DocCopy_tx(ctx, tx, reqJson)
		case "del":
			return DocDel_tx(ctx, tx, reqJson)
		case "set":
			return DocSet_tx(ctx, tx, reqJson)
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
		case "reload":
			return nil, ldap.UpdateCache_tx(ctx, tx)
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
			return request_login.Del_tx(ctx, tx, reqJson)
		case "get":
			return request_login.Get_tx(ctx, tx, reqJson)
		case "getIsNotUnique":
			return request_login.GetIsNotUnique_tx(ctx, tx, reqJson)
		case "getMembers":
			return request_login.GetMembers_tx(ctx, tx, reqJson)
		case "getRecords":
			return request_login.GetRecords_tx(ctx, tx, reqJson)
		case "kick":
			return request_login.Kick(ctx, tx, reqJson)
		case "reauth":
			return request_login.Reauth_tx(ctx, tx, reqJson)
		case "reauthAll":
			return request_login.ReauthAll_tx(ctx, tx)
		case "resetTotp":
			return request_login.ResetTotp_tx(ctx, tx, reqJson)
		case "set":
			return request_login.Set_tx(ctx, tx, reqJson)
		case "setMembers":
			return request_login.SetMembers_tx(ctx, tx, reqJson)
		}
	case "loginExportKey":
		switch action {
		case "del":
			return request_login.ExportKeyDel_tx(ctx, tx, loginId)
		case "get":
			return request_login.ExportKeyGet_tx(ctx, tx, loginId)
		case "set":
			return request_login.ExportKeySet_tx(ctx, tx, reqJson, loginId)
		}
	case "loginForm":
		switch action {
		case "del":
			return request_login.FormDel_tx(ctx, tx, reqJson)
		case "set":
			return request_login.FormSet_tx(ctx, tx, reqJson)
		}
	case "loginRepoCred":
		switch action {
		case "del":
			return request_login.RepoCredDel_tx(ctx, tx, reqJson, loginId)
		case "get":
			return request_login.RepoCredGet_tx(ctx, tx, reqJson, loginId)
		case "set":
			return request_login.RepoCredSet_tx(ctx, tx, reqJson, loginId)
		}
	case "loginSession":
		switch action {
		case "get":
			return request_login.SessionsGet_tx(ctx, tx, reqJson)
		case "getConcurrent":
			return request_login.SessionConcurrentGet_tx(ctx, tx)
		}
	case "loginTemplate":
		switch action {
		case "del":
			return request_login.TemplateDel_tx(ctx, tx, reqJson)
		case "get":
			return request_login.TemplateGet_tx(ctx, tx, reqJson)
		case "set":
			return request_login.TemplateSet_tx(ctx, tx, reqJson)
		}
	case "mailAccount":
		switch action {
		case "del":
			return MailAccountDel_tx(ctx, tx, reqJson)
		case "get":
			return MailAccountGet()
		case "reload":
			return nil, cache.LoadMailAccountMap_tx(ctx, tx)
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
	case "menuTab":
		switch action {
		case "del":
			return MenuTabDel_tx(ctx, tx, reqJson)
		case "set":
			return MenuTabSet_tx(ctx, tx, reqJson)
		}
	case "module":
		switch action {
		case "checkChange":
			return ModuleCheckChange_tx(ctx, tx, reqJson)
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
			return OauthClientReload_tx(ctx, tx)
		case "set":
			return OauthClientSet_tx(ctx, tx, reqJson)
		}
	case "package":
		switch action {
		case "install":
			return PackageInstall(ctx)
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
			return nil, cache.LoadPwaDomainMap_tx(ctx, tx)
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
	case "repo":
		switch action {
		case "commit":
			return RepoCommit(ctx, reqJson, loginId)
		case "del":
			return RepoDel_tx(ctx, tx, reqJson)
		case "get":
			return cache.GetRepos(), nil
		case "refresh":
			return nil, repo.RefreshAll_tx(ctx, tx)
		case "set":
			return RepoSet_tx(ctx, tx, reqJson)
		}
	case "repoModule":
		switch action {
		case "get":
			return RepoModuleGet_tx(ctx, tx, reqJson)
		case "install":
			return RepoModuleInstall(ctx, reqJson)
		case "installAll":
			return nil, repo.InstallModulesNewVersions(ctx)
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
			return SchemaReload_tx(ctx, tx, reqJson)
		}
	case "searchBar":
		switch action {
		case "del":
			return SearchBarDel_tx(ctx, tx, reqJson)
		case "set":
			return SearchBarSet_tx(ctx, tx, reqJson)
		}
	case "task":
		switch action {
		case "informChanged":
			return nil, cluster.TasksChanged_tx(ctx, tx, true)
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
			return TransferStoreExportKey(reqJson, loginId)
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
	return nil, fmt.Errorf("unknown resource or action")
}
