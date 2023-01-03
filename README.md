## REI3
REI3 is an open low code application platform. It runs on almost any system, on-premise or in the cloud and is free to use for individuals and organizations.

Applications are built with the integrated, graphical [Builder](https://rei3.de/en/docs) utility, after which they can be signed, exported, shared and/or sold. A growing range of free, production ready [business applications](https://rei3.de/en/applications) are publicly available.

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
  * Multi factor authentication.
* For enterprise environments:
  * LDAP import for user logins and access permissions.
  * Cluster management
  * Customization of application colors, names, welcome messages and so on.

## 📀 How to install

### Windows
1. [Download](https://rei3.de/en/downloads) and execute the installer. If you choose the stand-alone mode, REI3 is automatically configured for you.
1. That´s it.

If you want to use your own database server, you can install REI3 in dedicated mode - visit the [admin documentation](https://rei3.de/en/docs/admin) to learn more.

A portable version is also available for Windows clients for testing and developing applications. 

### Linux
1. Prepare a PostgreSQL server with a new, empty database.
1. [Download](https://rei3.de/en/downloads) and extract the precompiled Linux package (in `/opt/rei3` for example).
1. Make the file `r3` executable (`chmod u+x r3`).
1. Rename the file `config_template.json` to `config.json` and enter connection details to the chosen database (PostgreSQL, UTF8 encoded).
1. Install REI3 as a service (`./r3 -install`).
1. Start REI3 with your service manager (as in `systemctl start rei3`).
1. That´s it.

For the full [admin documentation](https://rei3.de/en/docs/admin), please visit the website.

## 💡 How to build applications
All versions of REI3 include the graphical Builder utility, which can create new or change existing applications. After installing REI3, an administrator can enable the Builder inside the system configuration page. The maintenance mode must be enabled first, which will kick all non-admin users from the system while changes are being made.

For information about how to use the Builder, please visit the [Builder documentation](https://rei3.de/en/docs/builder).

## 📑 How to create your own version of REI3
1. Install the latest version of [Golang](https://golang.org/dl/).
1. Download & extract the source code of the version you want to build (as in `2.4.3.2799`).
1. Go into the source code directory (where `r3.go` is located) and execute: `go build -ldflags "-X main.appVersion={YOUR_APP_VERSION}"`.
   * Replace `{YOUR_APP_VERSION}` with the version of the extracted source code. Example: `go build -ldflags "-X main.appVersion=2.5.1.2980"`
   * You can change the build version anytime. If you want to upgrade the major/minor version numbers however, you need to deal with upgrading the REI3 database (see `db/upgrade/upgrade.go`).
   * By setting the environment parameter `GOOS`, you can cross-compile for other systems (`GOOS=windows`, `GOOS=linux`, ...).
   * Since REI3 2.5, static resource files (HTML, JS, CSS, etc.) are embedded into the binary during compilation.
1. Use your new, compiled binary of REI3 to replace an already installed one.
1. You are now running your own version of REI3.

## 📇 Technologies
The REI3 server application is built on [Golang](https://golang.org/) with the frontend primarily based on [Vue.js](https://vuejs.org/). By using modern web standards, REI3 applications run very fast (cached application schemas, data-only websocket transfers) and can optionally be installed as progressive web apps (PWA) on client devices.

REI3 heavily relies on [PostgreSQL](https://www.postgresql.org/) for data management, storage and backend functions.

## 👏 How to contribute
Contributions are always welcome - feel free to fork and submit pull requests.

REI3 follows a four-digit versioning syntax, such as 3.2.0.4246 (MAJOR.MINOR.PATCH.BUILD). The major release will stay at 3 indefinitely, while we introduce new features and database changes with each minor release. Patch releases primarily focus on fixes, but may include small features as long as the database is not changed.

The branch `main` will contain the currently released minor version of REI3; patches for this version can directly be submitted for the main branch. Each new minor release will use a separate branch, which will merge with `main` once the latest minor version is released.
