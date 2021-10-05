REI3
====
REI3 is a business application platform that anyone can use. It includes access to a growing range of [business applications](https://rei3.de/applications/) that can be deployed and extended by organizations free of charge. New applications are created with the integrated [Builder](https://rei3.de/docu/) graphical utility and can be added to a global or self-hosted repositories.

Installation wizards for standalone as well as support for dedicated systems allow large and small organizations to deploy REI3 for their individual needs.

Technologies
============
The REI3 server application is built on [Golang](https://golang.org/) with the frontend primarily based on [Vue.js](https://vuejs.org/). By using modern web standards, REI3 applications run very fast (cached application schemas, data-only websocket transfers) and can optionally be installed as progressive web apps (PWA) on client devices.

REI3 heavily relies on [PostgreSQL](https://www.postgresql.org/) for data management, storage and backend functions.

How to build
============
To build REI3 a current version of [Golang](https://golang.org/dl/) must be installed. Inside the r3 source directory (where `r3.go` is located), `go build` will download Golang dependencies and build the current version of REI3. The Javascript parts of REI3 (located in `www`) do not need to be pre-compiled - REI3´s frontend runs natively in modern browsers. REI3 is compiled with [Rollup](https://rollupjs.org/guide/en/) for release builds.

To run your own REI3 version, the regular system requirements must be met - in short: A reachable PostgreSQL database with full permissions and connection details stored in the configuration file `config.json`. REI3 can be run from a console, such as `r3 -run`. For more details please refer to the [admin docs](https://rei3.de/admindocu-en_us/).

How to contribute
=================
Contributions are always welcome - feel free to fork and submit pull requests.

REI3 follows a four-digit versioning syntax, such as 2.4.2.2788 (MAJOR.MINOR.PATCH.BUILD). Major releases serve to introduce major changes to the application. Minor releases may bring new features, database changes and fixes. Patch releases should primarily focus on fixes, but may include small features as long as the database is not changed - they should only ever improve stability of a version, not introduce new issues.

The main branch will contain the currently released minor version of REI3; patches for this version can directly be submitted for the main branch. Each new minor release will use a separate branch, which will merge with main once the latest minor version is released.
