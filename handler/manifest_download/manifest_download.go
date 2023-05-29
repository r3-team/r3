package manifest_download

import (
	"encoding/json"
	"fmt"
	"net/http"
	"r3/cache"
	"r3/config"
	"r3/handler"
	"r3/tools"
	"strings"

	"github.com/gofrs/uuid"
)

type icon struct {
	Purpose string `json:"purpose"`
	Sizes   string `json:"sizes"`
	Src     string `json:"src"`
	Type    string `json:"type"`
}
type manifest struct {
	Id        string `json:"id"`
	Name      string `json:"name"`
	ShortName string `json:"short_name"`

	// theming
	BackgroundColor string `json:"background_color"`
	Icons           []icon `json:"icons"`
	ThemeColor      string `json:"theme_color"`

	// display
	Display     string `json:"display"`
	Orientation string `json:"orientation"`

	// worker
	Scope    string `json:"scope"`
	StartUrl string `json:"start_url"`
}

var (
	handlerContext  = "manifest_download"
	manifestDefault = manifest{
		Id:              "platform",
		Name:            "REI3",
		ShortName:       "REI3",
		Scope:           "/",
		StartUrl:        "/",
		Display:         "standalone",
		Orientation:     "any",
		BackgroundColor: "#f5f5f5",
		ThemeColor:      "#444444",
		Icons: []icon{
			icon{Purpose: "any", Sizes: "192x192", Src: "/images/icon_fav192.png", Type: "image/png"},
			icon{Purpose: "any", Sizes: "512x512", Src: "/images/icon_fav512.png", Type: "image/png"},
			icon{Purpose: "maskable", Sizes: "192x192", Src: "/images/icon_mask192.png", Type: "image/png"},
			icon{Purpose: "maskable", Sizes: "512x512", Src: "/images/icon_mask512.png", Type: "image/png"},
		},
	}
)

func Handler(w http.ResponseWriter, r *http.Request) {

	if r.Method != "GET" {
		handler.AbortRequestNoLog(w, handler.ErrGeneral)
		return
	}

	/*
		Parse URL, such as:
		GET /manifests/
		GET /manifests/123e4567-e89b-12d3-a456-426614174000

		The first is for the generic platform manifest the other for the module specific one
	*/
	elements := strings.Split(r.URL.Path, "/")

	if len(elements) != 3 {
		handler.AbortRequestNoLog(w, handler.ErrGeneral)
		return
	}

	// platform PWA
	if elements[2] == "" {
		manifestApp := manifestDefault
		if config.GetLicenseActive() {
			if config.GetString("appName") != "" {
				manifestApp.Name = tools.Substring(config.GetString("appName"), 0, 60)
			}
			if config.GetString("appNameShort") != "" {
				manifestApp.ShortName = tools.Substring(config.GetString("appNameShort"), 0, 12)
			}
			if config.GetString("companyColorHeader") != "" {
				manifestApp.ThemeColor = fmt.Sprintf("#%s", config.GetString("companyColorHeader"))
			}
			if config.GetString("iconPwa1") != "" && config.GetString("iconPwa2") != "" {
				manifestApp.Icons = []icon{
					icon{Purpose: "any", Sizes: "192x192", Src: fmt.Sprintf("data:image/png;base64,%s", config.GetString("iconPwa1")), Type: "image/png"},
					icon{Purpose: "any", Sizes: "512x512", Src: fmt.Sprintf("data:image/png;base64,%s", config.GetString("iconPwa2")), Type: "image/png"},
				}
			}
		}

		payloadJson, err := json.Marshal(manifestApp)
		if err != nil {
			handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
			return
		}

		// deliver manifest
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(payloadJson)
		return
	}

	// module PWA
	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	moduleId, err := uuid.FromString(elements[2])
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	module, exists := cache.ModuleIdMap[moduleId]
	if !exists {
		handler.AbortRequest(w, handlerContext, handler.ErrSchemaUnknownModule(moduleId), handler.ErrGeneral)
		return
	}

	// check for module parent
	parentName := module.Name
	if module.ParentId.Valid {
		parent, exists := cache.ModuleIdMap[module.ParentId.Bytes]
		if !exists {
			handler.AbortRequest(w, handlerContext, handler.ErrSchemaUnknownModule(module.ParentId.Bytes), handler.ErrGeneral)
			return
		}
		parentName = parent.Name
	}

	// overwrite module PWA settings
	pathMod := fmt.Sprintf("/#/app/%s/%s", parentName, module.Name)
	manifestMod := manifestDefault
	manifestMod.Id = module.Id.String()
	manifestMod.Scope = pathMod
	manifestMod.StartUrl = pathMod
	manifestMod.ThemeColor = fmt.Sprintf("#%s", module.Color1)

	// optional PWA settings
	if module.NamePwa.Valid {
		manifestMod.Name = module.NamePwa.String
	}
	if module.NamePwaShort.Valid {
		manifestMod.ShortName = module.NamePwaShort.String
	}
	if module.IconIdPwa1.Valid && module.IconIdPwa2.Valid {
		iconPwa1, err := cache.GetPwaIcon(module.IconIdPwa1.Bytes)
		if err != nil {
			handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
			return
		}
		iconPwa2, err := cache.GetPwaIcon(module.IconIdPwa2.Bytes)
		if err != nil {
			handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
			return
		}

		manifestMod.Icons = []icon{
			icon{Purpose: "any", Sizes: "192x192", Src: fmt.Sprintf("data:image/png;base64,%s", iconPwa1), Type: "image/png"},
			icon{Purpose: "any", Sizes: "512x512", Src: fmt.Sprintf("data:image/png;base64,%s", iconPwa2), Type: "image/png"},
		}
	}

	payloadJson, err := json.Marshal(manifestMod)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	// deliver manifest
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(payloadJson)
}
