## REI3
REI3 is a business application platform that anyone can use. It provides access to a growing range of free [business applications](https://rei3.de/applications_en/), which are built with the integrated, graphical application [Builder](https://rei3.de/docu_en/).

Individuals and organizations can freely build on or create completely new applications. Once created, applications can be exported and shared with others via files or public repositories.

### ⭐ Features
* Easy to install on Windows and Linux systems with very few dependencies.
* Self-hosted or deployable to cloud systems as web-based service.
* Usable free of charge, with no user limit.
* Growing feature set for powerful applications:
  * Complex relationships, joined relation input forms, sub queries and so on.
  * Various frontend components, such as calendars, Gantt plans, color inputs, sliders and many more.
  * Support for complex functions and business rules with general or per-record access control, database triggers and more.
  * Mobile views, with options to optimize frontend components for easier use on small screens.
  * Sending and receiving mails with attachments.
  * Multi-language support.
  * API for read and write access.
* For enterprise environments:
  * LDAP import for user logins and access permissions.
  * Customization of application colors, names, welcome messages and so on.

## 📀 How to install

### Windows
1. [Download](https://rei3.de/download_en/) and execute the installer. If you choose the stand-alone mode, REI3 is automatically configured for you.
1. That´s it.

If you want to use your own database server, you can install REI3 in dedicated mode - visit the [admin documentation](https://rei3.de/admindocu-en_us/) to learn more.

A portable version is also available for Windows clients for testing and developing applications. 

### Linux
1. Prepare a PostgreSQL server with a new, empty database.
1. [Download](https://rei3.de/download_en/) and extract the precompiled Linux package.
1. Make the file `r3` executable.
1. Rename the file `config_template.json` to `config.json` and enter connection details to the chosen database.
1. Install REI3 as a service with `r3 -install`.
1. Start REI3 with your service manager, as in `systemctl start rei3`.
1. That´s it.

#### Example for `config.json` used for connect to the remote database  
```...json
{
        "db": {
                "embedded": false,
                "host": "192.168.0.20",
                "port": 5432,
                "name": "r3",
                "user": "r3",
                "pass": "r3"
        },
        "paths": {
                "certificates": "data/certificates/",
                "embeddedDbBin": "pgsql/bin/",
                "embeddedDbData": "data/database/",
                "files": "data/files/",
                "temp": "data/temp/",
                "transfer": "data/transfer"
        },
        "web": {
                "cert": "cert.crt",
                "key": "cert.key",
                "listen": "0.0.0.0",
                "port": 5443
        }
}
```
For the full [admin documentation](https://rei3.de/admindocu-en_us/), please visit the website.

## 💡 How to build applications
All versions of REI3 include the graphical Builder utility, which can create new or change existing applications. After installing REI3, an administrator can enable the Builder inside the system configuration page. The maintenance mode must be enabled first, which will kick all non-admin users from the system while changes are being made.

For information about how to use the Builder, please visit the [Builder documentation](https://rei3.de/builderdocu-en_us/).

## 📑 How to build your own version of REI3
1. Install the latest version of [Golang](https://golang.org/dl/).
1. Download & extract the source code of the version you want to build (as in `2.4.3.2799`).
1. Go into the source code directory (where `r3.go` is located) and execute: `go build -ldflags "-X main.appVersion={YOUR_APP_VERSION}"` Example: `go build -ldflags "-X main.appVersion=2.5.1.2980"`
   * Make sure to replace `{YOUR_APP_VERSION}` with the version of the extracted source code. At least the major/minor version must match, otherwise you need to deal with upgrading the REI3 database as well (see `db/upgrade/upgrade.go`).
   * By setting the environment parameter `GOOS`, you can build for either Windows (`GOOS=windows`) or Linux (`GOOS=linux`).
1. Use your new compiled version of REI3 to replace an installed version.
   * Starting with REI3 2.5, static resource files (HTML, JS, CSS, etc.) are embedded into the binary during compilation. Replacing the binary is enough to fully overwrite REI3.
1. You are now running your own version of REI3.

## 📇 Technologies
The REI3 server application is built on [Golang](https://golang.org/) with the frontend primarily based on [Vue.js](https://vuejs.org/). By using modern web standards, REI3 applications run very fast (cached application schemas, data-only websocket transfers) and can optionally be installed as progressive web apps (PWA) on client devices.

REI3 heavily relies on [PostgreSQL](https://www.postgresql.org/) for data management, storage and backend functions.

## 👏 How to contribute
Contributions are always welcome - feel free to fork and submit pull requests.

REI3 follows a four-digit versioning syntax, such as 2.4.2.2788 (MAJOR.MINOR.PATCH.BUILD). Major releases serve to introduce major changes to the application. Minor releases may bring new features, database changes and fixes. Patch releases should primarily focus on fixes, but may include small features as long as the database is not changed.

The branch `main` will contain the currently released minor version of REI3; patches for this version can directly be submitted for the main branch. Each new minor release will use a separate branch, which will merge with `main` once the latest minor version is released.
