package ldap_import

import (
	"encoding/base64"
	"errors"
	"fmt"
	"r3/cache"
	"r3/config"
	"r3/ldap/ldap_conn"
	"r3/log"
	"r3/login"
	"r3/types"
	"slices"
	"unicode/utf8"

	goldap "github.com/go-ldap/ldap/v3"
	"github.com/gofrs/uuid"
)

type loginType struct {
	active  bool
	name    string
	meta    types.LoginMeta
	roleIds []uuid.UUID
}

var (
	msAdExtDisabledAtrFlags = []string{"514", "546", "66050",
		"66082", "262658", "262690", "328194", "328226"}
	pageSize uint32 = 30
)

func RunAll() error {

	ldapIdMap := cache.GetLdapIdMap()

	if len(ldapIdMap) != 0 && !config.GetLicenseActive() {
		log.Warning("ldap", "skipping run", errors.New("no valid license"))
		return nil
	}

	for _, ldap := range ldapIdMap {
		if err := Run(ldap.Id); err != nil {
			return err
		}
	}
	return nil
}

func Run(ldapId int32) error {

	ldapConn, ldap, err := ldap_conn.ConnectAndBind(ldapId)
	if err != nil {
		return err
	}
	defer ldapConn.Close()

	// define attributes to lookup and filters to apply
	attributes := []string{"dn", ldap.KeyAttribute, ldap.LoginAttribute}

	// MS AD, add user account control (currently for account (de)activation)
	if ldap.MsAdExt {
		attributes = append(attributes, "userAccountControl")
	}

	// add login meta attributes if set
	if ldap.LoginMetaAttributes.Department != "" {
		attributes = append(attributes, ldap.LoginMetaAttributes.Department)
	}
	if ldap.LoginMetaAttributes.Email != "" {
		attributes = append(attributes, ldap.LoginMetaAttributes.Email)
	}
	if ldap.LoginMetaAttributes.Location != "" {
		attributes = append(attributes, ldap.LoginMetaAttributes.Location)
	}
	if ldap.LoginMetaAttributes.NameDisplay != "" {
		attributes = append(attributes, ldap.LoginMetaAttributes.NameDisplay)
	}
	if ldap.LoginMetaAttributes.NameFore != "" {
		attributes = append(attributes, ldap.LoginMetaAttributes.NameFore)
	}
	if ldap.LoginMetaAttributes.NameSur != "" {
		attributes = append(attributes, ldap.LoginMetaAttributes.NameSur)
	}
	if ldap.LoginMetaAttributes.Notes != "" {
		attributes = append(attributes, ldap.LoginMetaAttributes.Notes)
	}
	if ldap.LoginMetaAttributes.Organization != "" {
		attributes = append(attributes, ldap.LoginMetaAttributes.Organization)
	}
	if ldap.LoginMetaAttributes.PhoneFax != "" {
		attributes = append(attributes, ldap.LoginMetaAttributes.PhoneFax)
	}
	if ldap.LoginMetaAttributes.PhoneLandline != "" {
		attributes = append(attributes, ldap.LoginMetaAttributes.PhoneLandline)
	}
	if ldap.LoginMetaAttributes.PhoneMobile != "" {
		attributes = append(attributes, ldap.LoginMetaAttributes.PhoneMobile)
	}

	// MS AD: we have two choices to lookup nested groups
	// 1. lookup memberships of user (member attribute with LDAP_MATCHING_RULE_IN_CHAIN)
	//  -> 1 request to get all users and 1 request per user
	//   (lots of LDAP requests, little memory overhead as each user can be processed individually)
	// 2. lookup members of group (memberOf attribute with LDAP_MATCHING_RULE_IN_CHAIN)
	//  -> 1 request per group
	//   (few LDAP requests, large memory overhead as we need to collect all groups per user for all users)
	// We work with option 2 for now (1 LDAP request per group, keep users in memory until done)

	// keeping 1 million logins in memory with 3 role IDs each, uses ~300MB RAM
	// simulation ran: 2020-05-19, go 1.14.2
	logins := make(map[string]loginType) // key: key LDAP attribute

	// LDAP auto role assignment removes existing roles from user, defining no roles here would remove all access
	if ldap.AssignRoles && len(ldap.Roles) == 0 {
		return errors.New("no roles are defined for assignment by LDAP group")
	}

	// if LDAP auto role assignment is disabled, remove defined role assignments (do not need to be queried)
	if !ldap.AssignRoles && len(ldap.Roles) != 0 {
		ldap.Roles = make([]types.LdapRole, 0)
	}

	// to get users with and without roles, we need multiple queries
	// * query of users in membership of each defined group DN (for role assignment)
	// * query of just users (without we´d loose users that have no defined group DN assigned)
	ldap.Roles = append(ldap.Roles, types.LdapRole{}) // empty group DN

	for _, role := range ldap.Roles {

		filters := fmt.Sprintf("(&(objectClass=%s))", ldap.SearchClass)

		// set filters to search for group DN if role assignment is active
		// group DN is empty if just users are queried
		if ldap.AssignRoles && role.GroupDn != "" {

			if ldap.MsAdExt {
				filters = fmt.Sprintf("(&(objectClass=%s)(%s:1.2.840.113556.1.4.1941:=%s))",
					ldap.SearchClass, ldap.MemberAttribute, role.GroupDn)
			} else {
				filters = fmt.Sprintf("(&(objectClass=%s)(%s=%s))",
					ldap.SearchClass, ldap.MemberAttribute, role.GroupDn)
			}
		}

		// paged LDAP request
		pagingControl := goldap.NewControlPaging(pageSize)
		controls := []goldap.Control{pagingControl}
		for {
			log.Info("ldap", fmt.Sprintf("querying '%s': '%s' in '%s'",
				ldap.Name, filters, ldap.SearchDn))

			response, err := ldapConn.Search(goldap.NewSearchRequest(
				ldap.SearchDn,
				goldap.ScopeWholeSubtree,
				goldap.DerefAlways, 0, 0, false,
				filters,
				attributes,
				controls))

			if err != nil {
				return err
			}

			for _, entry := range response.Entries {

				// key attribute is used to uniquely identifiy an user
				// MS AD uses binary for some (like objectGUID), encode base64 if invalid UTF8
				var key string
				keyRaw := entry.GetRawAttributeValue(ldap.KeyAttribute)
				if utf8.Valid(keyRaw) {
					key = string(keyRaw)
				} else {
					key = fmt.Sprintf(base64.StdEncoding.EncodeToString(keyRaw))
				}

				l, exists := logins[key]
				if !exists {
					l = loginType{}
					l.active = true
					l.roleIds = make([]uuid.UUID, 0)
				}
				l.name = entry.GetAttributeValue(ldap.LoginAttribute)

				if ldap.MsAdExt {
					for _, value := range entry.GetAttributeValues("userAccountControl") {
						if slices.Contains(msAdExtDisabledAtrFlags, value) {
							l.active = false
						}
					}
				}

				if ldap.LoginMetaAttributes.Department != "" {
					l.meta.Department = entry.GetAttributeValue(ldap.LoginMetaAttributes.Department)
				}
				if ldap.LoginMetaAttributes.Email != "" {
					l.meta.Email = entry.GetAttributeValue(ldap.LoginMetaAttributes.Email)
				}
				if ldap.LoginMetaAttributes.Location != "" {
					l.meta.Location = entry.GetAttributeValue(ldap.LoginMetaAttributes.Location)
				}
				if ldap.LoginMetaAttributes.NameDisplay != "" {
					l.meta.NameDisplay = entry.GetAttributeValue(ldap.LoginMetaAttributes.NameDisplay)
				}
				if ldap.LoginMetaAttributes.NameFore != "" {
					l.meta.NameFore = entry.GetAttributeValue(ldap.LoginMetaAttributes.NameFore)
				}
				if ldap.LoginMetaAttributes.NameSur != "" {
					l.meta.NameSur = entry.GetAttributeValue(ldap.LoginMetaAttributes.NameSur)
				}
				if ldap.LoginMetaAttributes.Notes != "" {
					l.meta.Notes = entry.GetAttributeValue(ldap.LoginMetaAttributes.Notes)
				}
				if ldap.LoginMetaAttributes.Organization != "" {
					l.meta.Organization = entry.GetAttributeValue(ldap.LoginMetaAttributes.Organization)
				}
				if ldap.LoginMetaAttributes.PhoneFax != "" {
					l.meta.PhoneFax = entry.GetAttributeValue(ldap.LoginMetaAttributes.PhoneFax)
				}
				if ldap.LoginMetaAttributes.PhoneLandline != "" {
					l.meta.PhoneLandline = entry.GetAttributeValue(ldap.LoginMetaAttributes.PhoneLandline)
				}
				if ldap.LoginMetaAttributes.PhoneMobile != "" {
					l.meta.PhoneMobile = entry.GetAttributeValue(ldap.LoginMetaAttributes.PhoneMobile)
				}

				// role ID is empty if just users are queried
				if ldap.AssignRoles && role.RoleId != uuid.Nil && !slices.Contains(l.roleIds, role.RoleId) {
					l.roleIds = append(l.roleIds, role.RoleId)
				}
				logins[key] = l
			}

			// to prepare the next request, we check if the response
			//  contains another ControlPaging object and a not-empty cookie and
			//  copy that cookie into our pagingControl object:
			updatedControl := goldap.FindControl(response.Controls, goldap.ControlTypePaging)
			if ctrl, ok := updatedControl.(*goldap.ControlPaging); ctrl != nil && ok && len(ctrl.Cookie) != 0 {
				pagingControl.SetCookie(ctrl.Cookie)
				continue
			}

			// no new paging information is available or the cookie is empty, done
			break
		}
	}

	// import logins
	for key, l := range logins {
		log.Info("ldap", fmt.Sprintf("processing login '%s' (key: %s, roles: %d)", l.name, key, len(l.roleIds)))

		if err := login.SetLdapLogin(ldap, key, l.name, l.active, l.meta, l.roleIds); err != nil {
			log.Warning("ldap", fmt.Sprintf("failed to import login '%s'", l.name), err)
			continue
		}
	}

	log.Info("ldap", fmt.Sprintf("finished login import for '%s'", ldap.Name))
	return nil
}
