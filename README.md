REI3
====
REI3 is a business application platform that anyone can use. It provides access to a growing range of [business applications](https://rei3.de/applications_en/), which are offered for free.

Individuals and organizations can extend or create applications with the integrated, graphical application [Builder](https://rei3.de/docu_en/). Applications can also be exported and, if desired, imported into repositories to be shared with others.

How to install
==============
REI3 runs on Windows or Linux systems. On Windows systems it can be installed in minutes with a graphical installation wizard, while Linux systems are easily deployed with a pre-packaged binary. A portable version is also available for Windows clients for testing and developing applications. [Downloads](https://rei3.de/download_en/) are available on the official [website](https://rei3.de/home_en/).

For information about how to install and configure REI3, please visit the [admin documentation](https://rei3.de/admindocu-en_us/).

How to build applications
=========================
All versions of REI3 include the Builder utility, which can create new or change existing applications. After installing REI3, an administrator can enable the Builder inside the system configuration page. The maintenance mode must be enabled first, which will kick all non-admin users from the system while changes are being made.

For information about how to use the Builder, please visit the [Builder documentation](https://rei3.de/builderdocu-en_us/).

How to build your own version of REI3
=====================================
Building your own version of REI3 is simple:
1. Install the latest version of [Golang](https://golang.org/dl/).
1. Download & extract the source code of the version you want to build (as in `2.4.3.2799`).
1. Go into the source code directory (where `r3.go` is located) and execute: `go build -ldflags "-X main.appVersion={YOUR_APP_VERSION}"`
   * Make sure to replace `{YOUR_APP_VERSION}` with the version of the extracted source code. At least the major/minor version must match, otherwise you need to deal with upgrading the REI3 database as well (see `db/upgrade/upgrade.go`).
   * By setting the environment parameter `GOOS`, you can build for either Windows (`GOOS=windows`) or Linux (`GOOS=linux`).
1. Use your new compiled version of REI3 to replace an installed version.
   * Starting with REI3 2.5, static resource files (HTML, JS, CSS, language captions, etc.) are embedded into the binary during compilation. Replacing the binary is enough to fully overwrite REI3.
   * With versions before 2.5, you need to also overwrite the folders `var` and `www` if you made any changes to the frontend or language captions.
1. You are now running your own version of REI3.

Technologies
============
The REI3 server application is built on [Golang](https://golang.org/) with the frontend primarily based on [Vue.js](https://vuejs.org/). By using modern web standards, REI3 applications run very fast (cached application schemas, data-only websocket transfers) and can optionally be installed as progressive web apps (PWA) on client devices.

REI3 heavily relies on [PostgreSQL](https://www.postgresql.org/) for data management, storage and backend functions.

How to contribute
=================
Contributions are always welcome - feel free to fork and submit pull requests.

REI3 follows a four-digit versioning syntax, such as 2.4.2.2788 (MAJOR.MINOR.PATCH.BUILD). Major releases serve to introduce major changes to the application. Minor releases may bring new features, database changes and fixes. Patch releases should primarily focus on fixes, but may include small features as long as the database is not changed.

The branch `main` will contain the currently released minor version of REI3; patches for this version can directly be submitted for the main branch. Each new minor release will use a separate branch, which will merge with `main` once the latest minor version is released.
