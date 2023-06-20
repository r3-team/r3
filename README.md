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
  * Powerful functions and business rules with general or per-record access control, database triggers and more.
  * Mobile views, with options to optimize frontend components for easier use on small screens.
  * Sending and receiving mails with attachments.
  * PDF generation.
  * ICS calendar access.
  * Multi-language support.
  * Multi factor authentication.
  * Full-text search capabilities.
* For enterprise environments:
  * LDAP import for user logins and access permissions.
  * Cluster management.
  * Customization of application colors, names, welcome messages and so on.

## :ticket: Community
We´ve created a new forum to serve as an official site for REI3 discussions. Feel free to browse or sign-up to post questions, requests, issues and feedback. You can find the new forum at [community.rei3.de](https://community.rei3.de).

## 📀 How to install
REI3 is easy to setup, with a graphical installer and portable version on Windows, packages for Linux systems as well as a compose file for Docker environments. Installation packages are available on the [website](https://rei3.de/en/downloads).

To get a full step-by-step manuel, visit the [admin documentation](https://rei3.de/en/docs/admin). It also includes details about different deployment options and system requirements.

## 💡 How to build applications
All versions of REI3 include the graphical Builder utility, which you can use to create or change applications. After installing REI3, you can enable the Builder inside the system configuration page. The maintenance mode must be enabled first, which will kick all non-admin users from the system while changes are being made.

For information about how to use the Builder, please visit the [Builder documentation](https://rei3.de/en/docs/builder).

## 📑 How to create your own version of REI3
If you want to make changes to the REI3 platform itself, you can fork this repository or download the source code and then build your own executable.

1. Install the latest version of [Golang](https://golang.org/dl/).
1. Choose the source code for the version you want to build - usually that´s the master branch, but you can also choose any released version (as in `3.4.0.4705`).
1. Go into the source code directory (where `r3.go` is located) and execute: `go build -ldflags "-X main.appVersion={YOUR_APP_VERSION}"`.
   * Replace `{YOUR_APP_VERSION}` with the version of the extracted source code. Example: `go build -ldflags "-X main.appVersion=2.5.1.2980"`
   * You can change the build version anytime. If you want to upgrade the major/minor version numbers however, you need to deal with upgrading the REI3 database (see `db/upgrade/upgrade.go`).
   * By setting the environment parameter `GOOS`, you can cross-compile for other systems (`GOOS=windows`, `GOOS=linux`, ...).
   * Since REI3 2.5, static resource files (HTML, JS, CSS, etc.) are embedded into the binary during compilation - so changes to these files are only reflected after you recompile. Alternatively, you can use the `-wwwpath` command line argument to load REI3 with an external `www` directory, in which you can make changes directly.
1. Use your new, compiled binary of REI3 to replace an already installed one.
1. You are now running your own version of REI3.

## 📇 Technologies
The REI3 server application is built on [Golang](https://golang.org/) with the frontend primarily based on [Vue.js](https://vuejs.org/). By using modern web standards, REI3 applications run very fast (cached application schemas, data-only websocket transfers) and can optionally be installed as progressive web apps (PWA) on client devices.

REI3 heavily relies on [PostgreSQL](https://www.postgresql.org/) for data management, storage and backend functions.

## 👏 How to contribute
Contributions are always welcome - feel free to fork and submit pull requests.

REI3 follows a four-digit versioning syntax, such as 3.2.0.4246 (MAJOR.MINOR.PATCH.BUILD). The major release will stay at 3 indefinitely, while we introduce new features and database changes with each minor release. Patch releases primarily focus on fixes, but may include small features as long as the database is not changed.

The branch `main` will contain the currently released minor version of REI3; patches for this version can directly be submitted for the main branch. Each new minor release will use a separate branch, which will merge with `main` once the latest minor version is released.
