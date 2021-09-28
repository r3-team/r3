REI3
====
REI3 is a business application platform that anyone can use. It includes access to a growing range of [business applications](https://rei3.de/applications/) that can be deployed and extended by organizations free of charge. New applications are created with the integrated [Builder](https://rei3.de/docu/) graphical utility and can be added to the global or self-hosted repositories.

Installation wizards for standalone as well as support for dedicated systems allow large and small organizations to deploy REI3 for their needs.

Technologies
============
The REI3 server application is built on [Golang](https://golang.org/) with the frontend primarily based on [Vue.js](https://vuejs.org/). By using modern web standards, REI3 applications run very fast (cached application schemas, data-only websocket transfers) and can optionally be installed as PWA on client devices.

On the data side, REI3 heavily relies on [PostgreSQL](https://www.postgresql.org/) for data storage, functions and data access control.

Besides the application web frontend, REI3 connects to LDAP, offers CSV and ICS handlers as well as import/export functions for CSV data processing.

How to build
============
To build REI3 a current version of [Golang](https://golang.org/dl/) must be installed. Inside the r3 source directory (where `r3.go` is located), `go build` will download Golang dependencies and build the current version of REI3.

To get running quickly, an official version can be installed from the [REI3 website](https://rei3.de/download_en/); the r3 executable is then replaced with the newly built version. A valid `config.json` configuration file and PostgreSQL database must be available to run REI3.

The Javascript parts of REI3 do not need to be pre-compiled - REI3´s frontend runs natively in modern browsers. The official version combines and minifies the Javascript source files - this is done for various reasons but is not necessary to run a custom version of REI3.
