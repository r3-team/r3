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
	"r3/request/request_dbSync"
	"r3/request/request_geo"
	"r3/request/request_login"
	"r3/request/request_mail"
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
			return nil, DataDel_tx(ctx, tx, reqJson, loginId)
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
			return nil, DataSetKeys_tx(ctx, tx, reqJson)
		}
	case "doc":
		switch action {
		case "create":
			return DocCreate(ctx, reqJson, loginId)
		}
	case "event":
		switch action {
		case "clientEventsChanged":
			return nil, eventClientEventsChanged_tx(ctx, tx, loginId, address)
		case "filesCopied":
			return nil, eventFilesCopied_tx(ctx, tx, reqJson, loginId, address)
		case "fileRequested":
			return nil, eventFileRequested_tx(ctx, tx, reqJson, loginId, address)
		case "keystrokesRequested":
			return nil, eventKeystrokesRequested_tx(ctx, tx, reqJson, loginId, address)
		}
	case "feedback":
		switch action {
		case "send":
			return nil, FeedbackSend(reqJson)
		}
	case "file":
		switch action {
		case "paste":
			return filesPaste_tx(ctx, tx, reqJson, loginId)
		}
	case "geoFieldAssign":
		switch action {
		case "get":
			return request_geo.FieldAssignGet_tx(ctx, tx, reqJson)
		}
	case "geoLayerBase":
		switch action {
		case "get":
			return request_geo.LayerBaseGet_tx(ctx, tx)
		}
	case "login":
		switch action {
		case "getNames":
			return request_login.GetNames_tx(ctx, tx, reqJson)
		case "delTokenFixed":
			return nil, request_login.DelTokenFixed_tx(ctx, tx, reqJson, loginId)
		case "getTokensFixed":
			return request_login.GetTokensFixed_tx(ctx, tx, loginId)
		case "setTokenFixed":
			return request_login.SetTokenFixed_tx(ctx, tx, reqJson, loginId)
		}
	case "loginClientEvent":
		switch action {
		case "del":
			return nil, request_login.ClientEventDel_tx(ctx, tx, reqJson, loginId)
		case "get":
			return request_login.ClientEventGet_tx(ctx, tx, loginId)
		case "set":
			return nil, request_login.ClientEventSet_tx(ctx, tx, reqJson, loginId)
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
			return nil, request_login.SetFavorites_tx(ctx, tx, reqJson, loginId)
		}
	case "loginKeys":
		switch action {
		case "getPublic":
			return request_login.KeysGetPublic_tx(ctx, tx, reqJson)
		case "reset":
			return nil, request_login.KeysReset_tx(ctx, tx, loginId)
		case "store":
			return nil, request_login.KeysStore_tx(ctx, tx, reqJson, loginId)
		case "storePrivate":
			return nil, request_login.KeysStorePrivate_tx(ctx, tx, reqJson, loginId)
		}
	case "loginOptions":
		switch action {
		case "del":
			if isNoAuth {
				return nil, errors.New(handler.ErrUnauthorized)
			}
			return nil, request_login.OptionsDel_tx(ctx, tx, loginId)
		case "get":
			return request_login.OptionsGet_tx(ctx, tx, reqJson, loginId, isNoAuth)
		case "set":
			if isNoAuth {
				return nil, errors.New(handler.ErrUnauthorized)
			}
			return nil, request_login.OptionsSet_tx(ctx, tx, reqJson, loginId)
		}
	case "loginPassword":
		if isNoAuth {
			return nil, errors.New(handler.ErrUnauthorized)
		}
		switch action {
		case "reset":
			return nil, request_login.PasswortReset_tx(ctx, tx, reqJson, loginId)
		case "set":
			return nil, request_login.PasswortSet_tx(ctx, tx, reqJson, loginId)
		}
	case "loginSetting":
		switch action {
		case "get":
			return request_login.SettingsGet_tx(ctx, tx, loginId)
		case "set":
			if isNoAuth {
				return nil, errors.New(handler.ErrUnauthorized)
			}
			return nil, request_login.SettingsSet_tx(ctx, tx, reqJson, loginId)
		}
	case "loginWidgetGroups":
		switch action {
		case "get":
			return request_login.WidgetGroupsGet_tx(ctx, tx, loginId)
		case "set":
			return nil, request_login.WidgetGroupsSet_tx(ctx, tx, reqJson, loginId)
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
			return nil, ApiCopy_tx(ctx, tx, reqJson)
		case "del":
			return nil, ApiDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, ApiSet_tx(ctx, tx, reqJson)
		}
	case "article":
		switch action {
		case "assign":
			return nil, ArticleAssign_tx(ctx, tx, reqJson)
		case "del":
			return nil, ArticleDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, ArticleSet_tx(ctx, tx, reqJson)
		}
	case "attribute":
		switch action {
		case "del":
			return nil, AttributeDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, AttributeSet_tx(ctx, tx, reqJson)
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
			return nil, CaptionMapSetOne_tx(ctx, tx, reqJson)
		}
	case "clientEvent":
		switch action {
		case "del":
			return nil, clientEventDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, clientEventSet_tx(ctx, tx, reqJson)
		}
	case "collection":
		switch action {
		case "del":
			return nil, CollectionDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, CollectionSet_tx(ctx, tx, reqJson)
		}
	case "config":
		switch action {
		case "get":
			return ConfigGet()
		case "set":
			return nil, ConfigSet_tx(ctx, tx, reqJson)
		}
	case "cluster":
		switch action {
		case "delNode":
			return nil, ClusterNodeDel_tx(ctx, tx, reqJson)
		case "getNodes":
			return ClusterNodesGet_tx(ctx, tx)
		case "setNode":
			return nil, ClusterNodeSet_tx(ctx, tx, reqJson)
		case "shutdownNode":
			return nil, ClusterNodeShutdown_tx(ctx, tx, reqJson)
		}
	case "dataSql":
		switch action {
		case "get":
			return DataSqlGet_tx(ctx, tx, reqJson, loginId)
		}
	case "dbSync":
		switch action {
		case "delHost":
			return nil, request_dbSync.HostDel_tx(ctx, tx, reqJson)
		case "delJob":
			return nil, request_dbSync.JobDel_tx(ctx, tx, reqJson)
		case "getHosts":
			return request_dbSync.HostsGet_tx(ctx, tx)
		case "getJobs":
			return request_dbSync.JobsGet_tx(ctx, tx)
		case "getJobLoadPreview":
			return request_dbSync.JobLoadPreviewGet(ctx, reqJson)
		case "getJobLogs":
			return request_dbSync.JobLogGet(ctx, tx, reqJson)
		case "setHost":
			return nil, request_dbSync.HostSet_tx(ctx, tx, reqJson)
		case "setJob":
			return nil, request_dbSync.JobSet_tx(ctx, tx, reqJson)
		case "informChanged":
			return nil, cluster.DbSyncChanged_tx(ctx, tx, true)
		}
	case "doc":
		switch action {
		case "copy":
			return nil, DocCopy_tx(ctx, tx, reqJson)
		case "del":
			return nil, DocDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, DocSet_tx(ctx, tx, reqJson)
		}
	case "field":
		switch action {
		case "del":
			return nil, FieldDel_tx(ctx, tx, reqJson)
		}
	case "file":
		switch action {
		case "get":
			return FileGet_tx(ctx, tx)
		case "restore":
			return nil, FileRestore_tx(ctx, tx, reqJson)
		}
	case "form":
		switch action {
		case "copy":
			return nil, FormCopy_tx(ctx, tx, reqJson)
		case "del":
			return nil, FormDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, FormSet_tx(ctx, tx, reqJson)
		}
	case "geoFieldAssign":
		switch action {
		case "set":
			return request_geo.FieldAssignSet_tx(ctx, tx, reqJson)
		}
	case "geoLayerBase":
		switch action {
		case "del":
			return nil, request_geo.LayerBaseDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, request_geo.LayerBaseSet_tx(ctx, tx, reqJson)
		}
	case "icon":
		switch action {
		case "del":
			return nil, IconDel_tx(ctx, tx, reqJson)
		case "setName":
			return nil, IconSetName_tx(ctx, tx, reqJson)
		}
	case "jsFunction":
		switch action {
		case "del":
			return nil, JsFunctionDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, JsFunctionSet_tx(ctx, tx, reqJson)
		}
	case "key":
		switch action {
		case "create":
			return KeyCreate(reqJson)
		}
	case "ldap":
		switch action {
		case "check":
			return nil, LdapCheck(reqJson)
		case "del":
			return nil, LdapDel_tx(ctx, tx, reqJson)
		case "get":
			return LdapGet_tx(ctx, tx)
		case "reload":
			return nil, ldap.UpdateCache_tx(ctx, tx)
		case "set":
			return nil, LdapSet_tx(ctx, tx, reqJson)
		}
	case "license":
		switch action {
		case "del":
			return nil, LicenseDel_tx(ctx, tx)
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
			return nil, request_login.Del_tx(ctx, tx, reqJson)
		case "get":
			return request_login.Get_tx(ctx, tx, reqJson)
		case "getIsNotUnique":
			return request_login.GetIsNotUnique_tx(ctx, tx, reqJson)
		case "getMembers":
			return request_login.GetMembers_tx(ctx, tx, reqJson)
		case "getRecords":
			return request_login.GetRecords_tx(ctx, tx, reqJson)
		case "kick":
			return nil, request_login.Kick(ctx, tx, reqJson)
		case "reauth":
			return nil, request_login.Reauth_tx(ctx, tx, reqJson)
		case "reauthAll":
			return nil, request_login.ReauthAll_tx(ctx, tx)
		case "resetTotp":
			return nil, request_login.ResetTotp_tx(ctx, tx, reqJson)
		case "set":
			return request_login.Set_tx(ctx, tx, reqJson)
		case "setMembers":
			return nil, request_login.SetMembers_tx(ctx, tx, reqJson)
		}
	case "loginExportKey":
		switch action {
		case "del":
			return nil, request_login.ExportKeyDel_tx(ctx, tx, loginId)
		case "get":
			return request_login.ExportKeyGet_tx(ctx, tx, loginId)
		case "set":
			return nil, request_login.ExportKeySet_tx(ctx, tx, reqJson, loginId)
		}
	case "loginForm":
		switch action {
		case "del":
			return nil, request_login.FormDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, request_login.FormSet_tx(ctx, tx, reqJson)
		}
	case "loginRepoCred":
		switch action {
		case "del":
			return nil, request_login.RepoCredDel_tx(ctx, tx, reqJson, loginId)
		case "get":
			return request_login.RepoCredGet_tx(ctx, tx, reqJson, loginId)
		case "set":
			return nil, request_login.RepoCredSet_tx(ctx, tx, reqJson, loginId)
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
			return nil, request_login.TemplateDel_tx(ctx, tx, reqJson)
		case "get":
			return request_login.TemplateGet_tx(ctx, tx, reqJson)
		case "set":
			return request_login.TemplateSet_tx(ctx, tx, reqJson)
		}
	case "mailAccount":
		switch action {
		case "del":
			return nil, request_mail.AccountDel_tx(ctx, tx, reqJson)
		case "get":
			return request_mail.AccountGet()
		case "reload":
			return nil, cluster.MailAccountsChanged_tx(ctx, tx, true)
		case "set":
			return nil, request_mail.AccountSet_tx(ctx, tx, reqJson)
		case "test":
			return nil, request_mail.AccountTest_tx(ctx, tx, reqJson)
		}
	case "mailSpooler":
		switch action {
		case "del":
			return nil, request_mail.SpoolerDel_tx(ctx, tx, reqJson)
		case "get":
			return request_mail.SpoolerGet_tx(ctx, tx, reqJson)
		case "getCountStuck":
			return request_mail.SpoolerGetCountStuck(ctx, tx, loginId)
		case "reset":
			return nil, request_mail.SpoolerReset_tx(ctx, tx, reqJson)
		}
	case "mailTemplate":
		switch action {
		case "del":
			return nil, request_mail.TemplateDel_tx(ctx, tx, reqJson)
		case "get":
			return request_mail.TemplateGet()
		case "reload":
			return nil, cluster.MailTemplatesChanged_tx(ctx, tx, true)
		case "set":
			return nil, request_mail.TemplateSet_tx(ctx, tx, reqJson)
		}
	case "mailTraffic":
		switch action {
		case "get":
			return request_mail.TrafficGet_tx(ctx, tx, reqJson)
		}
	case "menuTab":
		switch action {
		case "del":
			return nil, MenuTabDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, MenuTabSet_tx(ctx, tx, reqJson)
		}
	case "module":
		switch action {
		case "checkChange":
			return ModuleCheckChange_tx(ctx, tx, reqJson)
		case "del":
			return nil, ModuleDel_tx(ctx, tx, reqJson)
		case "set":
			return ModuleSet_tx(ctx, tx, reqJson)
		}
	case "moduleMeta":
		switch action {
		case "setLanguagesCustom":
			return nil, ModuleMetaSetLanguagesCustom_tx(ctx, tx, reqJson)
		case "setOptions":
			return nil, ModuleMetaSetOptions_tx(ctx, tx, reqJson)
		}
	case "oauthClient":
		switch action {
		case "del":
			return nil, OauthClientDel_tx(ctx, tx, reqJson)
		case "get":
			return OauthClientGet()
		case "reload":
			return nil, OauthClientReload_tx(ctx, tx)
		case "set":
			return nil, OauthClientSet_tx(ctx, tx, reqJson)
		}
	case "package":
		switch action {
		case "install":
			return nil, PackageInstall(ctx)
		}
	case "pgFunction":
		switch action {
		case "del":
			return nil, PgFunctionDel_tx(ctx, tx, reqJson)
		case "execAny": // admin may exec any non-trigger backend function
			return PgFunctionExec_tx(ctx, tx, reqJson, false)
		case "set":
			return nil, PgFunctionSet_tx(ctx, tx, reqJson)
		}
	case "pgIndex":
		switch action {
		case "del":
			return nil, PgIndexDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, PgIndexSet_tx(ctx, tx, reqJson)
		}
	case "pgTrigger":
		switch action {
		case "del":
			return nil, PgTriggerDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, PgTriggerSet_tx(ctx, tx, reqJson)
		}
	case "preset":
		switch action {
		case "del":
			return nil, PresetDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, PresetSet_tx(ctx, tx, reqJson)
		}
	case "pwaDomain":
		switch action {
		case "reset":
			return nil, cache.LoadPwaDomainMap_tx(ctx, tx)
		case "set":
			return nil, PwaDomainSet_tx(ctx, tx, reqJson)
		}
	case "relation":
		switch action {
		case "del":
			return nil, RelationDel_tx(ctx, tx, reqJson)
		case "preview":
			return RelationPreview_tx(ctx, tx, reqJson)
		case "set":
			return nil, RelationSet_tx(ctx, tx, reqJson)
		}
	case "repo":
		switch action {
		case "commit":
			return nil, RepoCommit(ctx, reqJson, loginId)
		case "del":
			return nil, RepoDel_tx(ctx, tx, reqJson)
		case "get":
			return cache.GetRepos(), nil
		case "refresh":
			return nil, repo.RefreshAll_tx(ctx, tx)
		case "set":
			return nil, RepoSet_tx(ctx, tx, reqJson)
		}
	case "repoModule":
		switch action {
		case "get":
			return RepoModuleGet_tx(ctx, tx, reqJson)
		case "install":
			return nil, RepoModuleInstall(ctx, reqJson)
		case "installAll":
			return nil, repo.InstallModulesNewVersions(ctx)
		}
	case "role":
		switch action {
		case "del":
			return nil, RoleDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, RoleSet_tx(ctx, tx, reqJson)
		}
	case "scheduler":
		switch action {
		case "get":
			return schedulersGet_tx(ctx, tx)
		}
	case "schema":
		switch action {
		case "check":
			return nil, SchemaCheck_tx(ctx, tx, reqJson)
		case "reload":
			return nil, SchemaReload_tx(ctx, tx, reqJson)
		}
	case "searchBar":
		switch action {
		case "del":
			return nil, SearchBarDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, SearchBarSet_tx(ctx, tx, reqJson)
		}
	case "tag":
		switch action {
		case "del":
			return nil, TagDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, TagSet_tx(ctx, tx, reqJson)
		}
	case "task":
		switch action {
		case "informChanged":
			return nil, cluster.TasksChanged_tx(ctx, tx, true)
		case "run":
			return nil, TaskRun_tx(ctx, tx, reqJson)
		case "set":
			return nil, TaskSet_tx(ctx, tx, reqJson)
		}
	case "transfer":
		switch action {
		case "addVersion":
			return nil, TransferAddVersion_tx(ctx, tx, reqJson)
		case "storeExportKey":
			return nil, TransferStoreExportKey(reqJson, loginId)
		}
	case "variable":
		switch action {
		case "del":
			return nil, VariableDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, VariableSet_tx(ctx, tx, reqJson)
		}
	case "widget":
		switch action {
		case "del":
			return nil, WidgetDel_tx(ctx, tx, reqJson)
		case "set":
			return nil, WidgetSet_tx(ctx, tx, reqJson)
		}
	}
	return nil, fmt.Errorf("unknown resource or action")
}
