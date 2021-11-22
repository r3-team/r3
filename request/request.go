package request

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/handler"
	"r3/log"
	"r3/scheduler"
	"r3/types"
	"regexp"
	"strconv"
	"time"

	"github.com/jackc/pgx/v4"
)

var expectedErrorRx = []*regexp.Regexp{

	// context timeouts
	regexp.MustCompile(`^timeout\: context deadline exceeded$`),
	regexp.MustCompile(`^timeout\: context canceled$`),

	// unauthorized access attempt
	regexp.MustCompile(fmt.Sprintf(`^%s$`, handler.ErrUnauthorized)),

	// protected preset deletion attempt
	regexp.MustCompile(fmt.Sprintf(`^%s$`, handler.ErrPresetProtected)),

	// foreign key constraint violation
	regexp.MustCompile(`^ERROR\: .+ on table \".+\" violates foreign key constraint \"fk_.{36}\"`),

	// unique constraint violation
	// do not limit regex to "ind_" prefixes for unique constraints, is used for app-schema indexes as well
	regexp.MustCompile(`^ERROR\: duplicate key value violates unique constraint \".*\"`),

	// custom error message from application, used in instance.abort_show_message()
	regexp.MustCompile(`^ERROR\: R3_MSG\: `),
}

func isExpectedError(err error) bool {
	for _, regex := range expectedErrorRx {
		if regex.MatchString(err.Error()) {
			return true
		}
	}
	return false
}

func ExecTransaction(ctxClient context.Context, loginId int64, isAdmin bool,
	isNoAuth bool, reqTrans types.RequestTransaction,
	resTrans types.ResponseTransaction) types.ResponseTransaction {

	// start transaction
	ctx, ctxCancel := context.WithTimeout(ctxClient,
		time.Duration(int64(config.GetUint64("dbTimeoutDataWs")))*time.Second)

	defer ctxCancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Error("server", "cannot begin transaction", err)
		resTrans.Error = handler.ErrGeneral
		return resTrans
	}

	// set local transaction configuration parameters
	// these are used by system functions, such as instance.get_login_id()
	if _, err := tx.Exec(ctx, `
		SELECT SET_CONFIG('r3.login_id',$1,TRUE)
	`, strconv.FormatInt(loginId, 10)); err != nil {

		log.Error("server", fmt.Sprintf("TRANSACTION %d, transaction config failure (login ID %d)",
			reqTrans.TransactionNr, loginId), err)

		return resTrans
	}

	// work through requests
	for _, req := range reqTrans.Requests {

		log.Info("server", fmt.Sprintf("TRANSACTION %d, %s %s, payload: %s",
			reqTrans.TransactionNr, req.Action, req.Ressource, req.Payload))

		payload, err := Exec_tx(ctx, tx, loginId, isAdmin, isNoAuth,
			req.Ressource, req.Action, req.Payload)

		if err == nil {
			// all clear, prepare response payload
			var res types.Response
			res.Payload, err = json.Marshal(payload)
			if err == nil {
				resTrans.Responses = append(resTrans.Responses, res)
				continue
			}
		}

		// request returned with error, check for expected error
		if !isExpectedError(err) {
			// unexpected errors during requests could be badly formed requests
			//  from frontend, these are not necessarely system errors -> warning
			log.Warning("server", fmt.Sprintf("TRANSACTION %d, request %s %s failure (login ID %d)",
				reqTrans.TransactionNr, req.Ressource, req.Action, loginId), err)

			// overwrite error message for non-admins if unexpected
			// non-admins should not get insight into the system
			if !isAdmin {
				err = errors.New(handler.ErrGeneral)
			}
		} else {
			// expected errors can be sent back to requestor
			err = fmt.Errorf("%s: %s", handler.ErrBackend, err.Error())
		}

		resTrans.Error = fmt.Sprintf("%v", err)
		resTrans.Responses = make([]types.Response, 0) // clear all responses
		break
	}

	// check if error occured in any request
	if resTrans.Error == "" {
		if err := tx.Commit(ctx); err != nil {
			// for normal users, there are no expected errors causing a commit issue
			// admins get original error message
			if isAdmin {
				resTrans.Error = err.Error()
			} else {
				resTrans.Error = handler.ErrGeneral
			}
			resTrans.Responses = make([]types.Response, 0)

			log.Warning("server", fmt.Sprintf("TRANSACTION %d, commit failure (login ID %d)",
				reqTrans.TransactionNr, loginId), err)

			tx.Rollback(ctx)
		}
	} else {
		tx.Rollback(ctx)
	}
	return resTrans
}

func Exec_tx(ctx context.Context, tx pgx.Tx, loginId int64, isAdmin bool, isNoAuth bool,
	ressource string, action string, reqJson json.RawMessage) (interface{}, error) {

	// public requests
	switch ressource {
	case "public":
		switch action {
		case "get":
			return PublicGet()
		}
	}

	// authorized requests: non-admin
	if loginId == 0 {
		return nil, errors.New(handler.ErrUnauthorized)
	}

	switch ressource {
	case "data":
		switch action {
		case "del":
			return DataDel_tx(ctx, tx, reqJson, loginId)
		case "get":
			return DataGet_tx(ctx, tx, reqJson, loginId)
		case "getLog":
			return DataLogGet_tx(ctx, tx, reqJson, loginId)
		case "set":
			return DataSet_tx(ctx, tx, reqJson, loginId)
		}
	case "feedback":
		switch action {
		case "send":
			return FeedbackSend_tx(tx, reqJson)
		}
	case "login":
		switch action {
		case "getNames":
			return LoginGetNames(reqJson)
		case "setTokenFixed":
			return LoginSetTokenFixed_tx(tx, reqJson, loginId)
		}
	case "lookup":
		switch action {
		case "get":
			return LookupGet(reqJson, loginId)
		}
	case "password":
		switch action {
		case "set":
			return PasswortSet_tx(tx, reqJson, loginId)
		}
	case "setting":
		switch action {
		case "get":
			return SettingsGet(loginId)
		case "set":
			if isNoAuth {
				return nil, errors.New(handler.ErrUnauthorized)
			}
			return SettingsSet_tx(tx, reqJson, loginId)
		}
	}

	// authorized requests: admin
	if !isAdmin {
		return nil, errors.New(handler.ErrUnauthorized)
	}

	switch ressource {
	case "attribute":
		switch action {
		case "del":
			return AttributeDel_tx(tx, reqJson)
		case "get":
			return AttributeGet(reqJson)
		case "set":
			return AttributeSet_tx(tx, reqJson)
		}
	case "bruteforce":
		switch action {
		case "get":
			return BruteforceGet(reqJson)
		}
	case "column":
		switch action {
		case "del":
			return ColumnDel_tx(tx, reqJson)
		}
	case "config":
		switch action {
		case "get":
			return ConfigGet()
		case "set":
			return ConfigSet_tx(tx, reqJson)
		}
	case "dataSql":
		switch action {
		case "get":
			return DataSqlGet_tx(ctx, tx, reqJson, loginId)
		}
	case "field":
		switch action {
		case "del":
			return FieldDel_tx(tx, reqJson)
		}
	case "form":
		switch action {
		case "copy":
			return FormCopy_tx(tx, reqJson)
		case "del":
			return FormDel_tx(tx, reqJson)
		case "get":
			return FormGet(reqJson)
		case "set":
			return FormSet_tx(tx, reqJson)
		}
	case "icon":
		switch action {
		case "del":
			return IconDel_tx(tx, reqJson)
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
			return LdapDel_tx(tx, reqJson)
		case "get":
			return LdapGet()
		case "import":
			return LdapImport(reqJson)
		case "reload":
			return nil, cache.LoadLdapMap()
		case "set":
			return LdapSet_tx(tx, reqJson)
		}
	case "license":
		switch action {
		case "get":
			return config.License, nil
		}
	case "log":
		switch action {
		case "get":
			return LogGet(reqJson)
		}
	case "login":
		switch action {
		case "del":
			return LoginDel_tx(tx, reqJson)
		case "get":
			return LoginGet(reqJson)
		case "getMembers":
			return LoginGetMembers(reqJson)
		case "getRecords":
			return LoginGetRecords(reqJson)
		case "informBuilderState":
			cache.ChangedBuilderMode(config.GetUint64("builderMode") == 1)
			return nil, nil
		case "kick":
			return LoginKick(reqJson)
		case "kickNonAdmins":
			cache.KickNonAdmins()
			return nil, nil
		case "reauth":
			return LoginReauth(reqJson)
		case "reauthAll":
			return LoginReauthAll()
		case "set":
			return LoginSet_tx(tx, reqJson)
		case "setMembers":
			return LoginSetMembers_tx(tx, reqJson)
		case "setRecord":
			return LoginSetRecord_tx(tx, reqJson)
		}
	case "loginForm":
		switch action {
		case "del":
			return LoginFormDel_tx(tx, reqJson)
		case "get":
			return LoginFormGet(reqJson)
		case "set":
			return LoginFormSet_tx(tx, reqJson)
		}
	case "mail":
		switch action {
		case "del":
			return MailDel_tx(tx, reqJson)
		case "get":
			return MailGet(reqJson)
		}
	case "mailAccount":
		switch action {
		case "del":
			return MailAccountDel_tx(tx, reqJson)
		case "get":
			return MailAccountGet()
		case "reload":
			return MailAccountReload()
		case "set":
			return MailAccountSet_tx(tx, reqJson)
		case "test":
			return MailAccountTest_tx(tx, reqJson)
		}
	case "menu":
		switch action {
		case "copy":
			return MenuCopy_tx(tx, reqJson)
		case "del":
			return MenuDel_tx(tx, reqJson)
		case "get":
			return MenuGet(reqJson)
		case "set":
			return MenuSet_tx(tx, reqJson)
		}
	case "module":
		switch action {
		case "checkChange":
			return ModuleCheckChange_tx(tx, reqJson)
		case "del":
			return ModuleDel_tx(tx, reqJson)
		case "get":
			return ModuleGet()
		case "set":
			return ModuleSet_tx(tx, reqJson)
		}
	case "moduleOption":
		switch action {
		case "get":
			return ModuleOptionGet()
		case "set":
			return ModuleOptionSet_tx(tx, reqJson)
		}
	case "package":
		switch action {
		case "install":
			return PackageInstall()
		}
	case "pgFunction":
		switch action {
		case "del":
			return PgFunctionDel_tx(tx, reqJson)
		case "get":
			return PgFunctionGet(reqJson)
		case "set":
			return PgFunctionSet_tx(tx, reqJson)
		}
	case "pgIndex":
		switch action {
		case "del":
			return PgIndexDel_tx(tx, reqJson)
		case "get":
			return PgIndexGet(reqJson)
		case "set":
			return PgIndexSet_tx(tx, reqJson)
		}
	case "pgTrigger":
		switch action {
		case "del":
			return PgTriggerDel_tx(tx, reqJson)
		case "set":
			return PgTriggerSet_tx(tx, reqJson)
		}
	case "preset":
		switch action {
		case "del":
			return PresetDel_tx(tx, reqJson)
		case "set":
			return PresetSet_tx(tx, reqJson)
		}
	case "relation":
		switch action {
		case "del":
			return RelationDel_tx(tx, reqJson)
		case "get":
			return RelationGet(reqJson)
		case "preview":
			return RelationPreview(reqJson)
		case "set":
			return RelationSet_tx(tx, reqJson)
		}
	case "repoModule":
		switch action {
		case "get":
			return RepoModuleGet(reqJson)
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
			return RoleDel_tx(tx, reqJson)
		case "get":
			return RoleGet(reqJson)
		case "set":
			return RoleSet_tx(tx, reqJson)
		}
	case "scheduler":
		switch action {
		case "get":
			return Get()
		case "reload":
			return nil, scheduler.Start()
		case "trigger":
			return Trigger(reqJson)
		}
	case "schema":
		switch action {
		case "check":
			return SchemaCheck_tx(tx, reqJson)
		case "reload":
			return SchemaReload(reqJson)
		}
	case "system":
		switch action {
		case "get":
			return SystemGet()
		}
	case "task":
		switch action {
		case "set":
			return TaskSet_tx(tx, reqJson)
		}
	case "transfer":
		switch action {
		case "addVersion":
			return TransferAddVersion_tx(tx, reqJson)
		case "storeExportKey":
			return TransferStoreExportKey(reqJson)
		}
	}
	return nil, fmt.Errorf("unknown ressource or action")
}
