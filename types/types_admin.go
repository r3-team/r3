package types

import (
	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type BackupDef struct {
	AppBuild  int    `json:"appBuild"`
	JobName   string `json:"jobName"`
	Timestamp int64  `json:"timestamp"`
}
type BackupTocFile struct {
	Backups []BackupDef `json:"backups"`
}

type Log struct {
	Level      int         `json:"level"`
	Context    string      `json:"context"`
	Message    string      `json:"message"`
	ModuleName pgtype.Text `json:"moduleName"`
	NodeName   pgtype.Text `json:"nodeName"`
	Date       int64       `json:"date"`
}

type LoginAdmin struct {
	Id               int64              `json:"id"`
	LdapId           pgtype.Int4        `json:"ldapId"`
	LdapKey          pgtype.Text        `json:"ldapKey"`
	Name             string             `json:"name"`
	Active           bool               `json:"active"`
	Admin            bool               `json:"admin"`
	Meta             LoginMeta          `json:"meta"`
	NoAuth           bool               `json:"noAuth"`
	LanguageCode     string             `json:"languageCode"`
	TokenExpiryHours pgtype.Int4        `json:"tokenExpiryHours"`
	Records          []LoginAdminRecord `json:"records"`
	RoleIds          []uuid.UUID        `json:"roleIds"`
}
type LoginAdminRecord struct {
	Id    pgtype.Int8 `json:"id"`    // record ID
	Label string      `json:"label"` // record label
}
type LoginAdminRecordGet struct {
	AttributeIdLogin  uuid.UUID `json:"attributeIdLogin"`
	AttributeIdLookup uuid.UUID `json:"attributeIdLookup"`
}
type LoginAdminRecordSet struct {
	AttributeId uuid.UUID `json:"attributeId"` // login attribute
	RecordId    int64     `json:"recordId"`
}
type LoginTemplateAdmin struct {
	Id       int64       `json:"id"`
	Name     string      `json:"name"`
	Comment  pgtype.Text `json:"comment"`
	Settings Settings    `json:"settings"`
}

type Ldap struct {
	Id              int32       `json:"id"`
	LoginTemplateId pgtype.Int8 `json:"loginTemplateId"` // template for new logins (applies login settings)
	Name            string      `json:"name"`
	Host            string      `json:"host"`
	Port            int         `json:"port"`
	BindUserDn      string      `json:"bindUserDn"`      // DN of bind user, example: 'CN=readonly,OU=User,DC=test,DC=local'
	BindUserPw      string      `json:"bindUserPw"`      // password of bind user in clear text
	SearchClass     string      `json:"searchClass"`     // object class to filter to, example: '(&(objectClass=user))'
	SearchDn        string      `json:"searchDn"`        // root search DN, example: 'OU=User,DC=test,DC=local'
	KeyAttribute    string      `json:"keyAttribute"`    // name of attribute used as key, example: 'objectGUID'
	LoginAttribute  string      `json:"loginAttribute"`  // name of attribute used as login, example: 'sAMAccountName'
	MemberAttribute string      `json:"memberAttribute"` // name of attribute used as membership, example: 'memberOf'
	AssignRoles     bool        `json:"assignRoles"`     // assign roles from group membership (see member attribute)
	MsAdExt         bool        `json:"msAdExt"`         // Microsoft AD extensions (nested group memberships, user account control)
	Starttls        bool        `json:"starttls"`        // upgrade unencrypted LDAP connection with TLS (STARTTLS)
	Tls             bool        `json:"tls"`             // connect to LDAP via SSL/TLS (LDAPS)
	TlsVerify       bool        `json:"tlsVerify"`       // verify TLS connection, can be used to allow non-trusted certificates
	Roles           []LdapRole  `json:"roles"`
}
type LdapRole struct {
	LdapId  int32     `json:"ldapId"`
	RoleId  uuid.UUID `json:"roleId"`
	GroupDn string    `json:"groupDn"`
}
type OauthClient struct {
	Id           int32    `json:"id"`
	Name         string   `json:"name"`
	ClientId     string   `json:"clientId"`
	ClientSecret string   `json:"clientSecret"`
	DateExpiry   int64    `json:"dateExpiry"`
	Scopes       []string `json:"scopes"`
	Tenant       string   `json:"tenant"`
	TokenUrl     string   `json:"tokenUrl"`
}
