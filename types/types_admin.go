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
	OauthClientId    pgtype.Int4        `json:"oauthClientId"`
	Name             string             `json:"name"`
	Active           bool               `json:"active"`
	Admin            bool               `json:"admin"`
	Meta             LoginMeta          `json:"meta"`
	NoAuth           bool               `json:"noAuth"`
	LanguageCode     string             `json:"languageCode"`
	Limited          bool               `json:"limited"`
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
	Id               int32             `json:"id"`
	LoginTemplateId  pgtype.Int8       `json:"loginTemplateId"` // template for new logins (applies login settings)
	Name             string            `json:"name"`
	Host             string            `json:"host"`
	Port             int               `json:"port"`
	BindUserDn       string            `json:"bindUserDn"`       // DN of bind user, example: 'CN=readonly,OU=User,DC=test,DC=local'
	BindUserPw       string            `json:"bindUserPw"`       // password of bind user in clear text
	SearchClass      string            `json:"searchClass"`      // object class to filter to, example: '(&(objectClass=user))'
	SearchDn         string            `json:"searchDn"`         // root search DN, example: 'OU=User,DC=test,DC=local'
	KeyAttribute     string            `json:"keyAttribute"`     // name of attribute used as key, example: 'objectGUID'
	LoginAttribute   string            `json:"loginAttribute"`   // name of attribute used as login, example: 'sAMAccountName'
	MemberAttribute  string            `json:"memberAttribute"`  // name of attribute used as membership, example: 'memberOf'
	LoginMetaMap     LoginMeta         `json:"loginMetaMap"`     // names of LDAP attributes to map to login meta data
	LoginRolesAssign []LoginRoleAssign `json:"loginRolesAssign"` // assign login roles based on LDAP group membership
	AssignRoles      bool              `json:"assignRoles"`      // assign login roles from group membership (see member attribute)
	MsAdExt          bool              `json:"msAdExt"`          // Microsoft AD extensions (nested group memberships, user account control)
	Starttls         bool              `json:"starttls"`         // upgrade unencrypted LDAP connection with TLS (STARTTLS)
	Tls              bool              `json:"tls"`              // connect to LDAP via SSL/TLS (LDAPS)
	TlsVerify        bool              `json:"tlsVerify"`        // verify TLS connection, can be used to allow non-trusted certificates
}

type OauthClient struct {
	Id           int32       `json:"id"`
	Name         string      `json:"name"`         // reference name, also shown on login page if authCodePkce
	Flow         string      `json:"flow"`         // clientCreds, authCodePkce
	ClientId     string      `json:"clientId"`     // client ID, as registered at the identity provider
	ClientSecret pgtype.Text `json:"clientSecret"` // client secret, as registered at the identity provider
	DateExpiry   pgtype.Int8 `json:"dateExpiry"`   // for admin notification mails
	Scopes       []string    `json:"scopes"`

	// clientCreds
	TokenUrl pgtype.Text `json:"tokenUrl"`

	// authCodePkce
	LoginTemplateId  pgtype.Int8       `json:"loginTemplateId"`  // template for new logins (applies login settings)
	LoginMetaMap     LoginMeta         `json:"loginMetaMap"`     // map claim key <-> login meta data key
	LoginRolesAssign []LoginRoleAssign `json:"loginRolesAssign"` // assign login roles based on claim content
	ClaimRoles       pgtype.Text       `json:"claimRoles"`       // name of claim that contains JSON array values for role mapping, such as { "roles":["my_role1", "my_role2", ...], ... }
	ClaimUsername    pgtype.Text       `json:"claimUsername"`
	ProviderUrl      pgtype.Text       `json:"providerUrl"`
	RedirectUrl      pgtype.Text       `json:"redirectUrl"`
}

// public reference for OAUTH client for Open ID Connect authentication
// must not contain sensitive data such as client secret
type OauthClientOpenId struct {
	Id          int32       `json:"id"`
	Name        string      `json:"name"`
	ClientId    string      `json:"clientId"`
	ProviderUrl pgtype.Text `json:"providerUrl"`
	RedirectUrl pgtype.Text `json:"redirectUrl"`
	Scopes      []string    `json:"scopes"`
}
