![r3_logo](https://github.com/r3-team/r3/assets/91060542/cc3918b6-7a11-4613-8dd8-de8a9fdbac7f)

<p align="center">REI3 - Free and open low code for everyone. Build and host powerful applications with full control and ownership.</p>

<p align="center">
	<a href="https://github.com/r3-team/r3/releases" target="_blank">
		<img src="https://img.shields.io/github/v/release/r3-team/r3" alt="Latest GitHub release" />
	</a>
	<a href="https://rei3.de/latest/x64_linux" target="_blank">
		<img src="https://img.shields.io/badge/linux-x64-yellow" alt="Latest Linux x64" />
	</a>
	<a href="https://rei3.de/latest/arm64_linux" target="_blank">
		<img src="https://img.shields.io/badge/linux-arm64-yellow" alt="Latest Linux arm64" />
	</a>
	<a href="https://rei3.de/latest/x64_installer" target="_blank">
		<img src="https://img.shields.io/badge/windows-x64-00a8e8" alt="Latest Windows x64" />
	</a>
	<a href="https://img.shields.io/github/go-mod/go-version/r3-team/r3" target="_blank">
		<img src="https://img.shields.io/github/go-mod/go-version/r3-team/r3" alt="GitHub go.mod Go version" />
	</a>
	<a href="https://github.com/r3-team/r3/stargazers" target="_blank">
		<img src="https://img.shields.io/github/stars/r3-team/r3" alt="GitHub repo stars" />
	</a>
	<a href="https://github.com/r3-team/r3/commits/main" target="_blank">
		<img src="https://img.shields.io/github/commit-activity/t/r3-team/r3" alt="GitHub commit activity" />
	</a>
	<a href="https://github.com/r3-team/r3/blob/main/LICENSE" target="_blank">
		<img src="https://img.shields.io/github/license/r3-team/r3" alt="License" />
	</a>
</p>

<br />
<p align="center">Free yourself from walled gardens and cloud-only SaaS offerings. REI3 enables powerful low code applications, selfhosted in the cloud or on-premise - installed quickly on almost any system. Applications you build with REI3 are yours, can be shared with others and can even be sold.</p>

![Screenshot 2023-07-11 at 11-30-12 Contact - DEMO](https://github.com/r3-team/r3/assets/91060542/a99b7651-49a7-4d4b-9a7d-f90689bf4577)
![Screenshot 2023-07-11 at 11-28-20 Ticket - DEMO](https://github.com/r3-team/r3/assets/91060542/e88c5d55-0e57-400d-a25a-8e274d58cc4e)
![Screenshot 2023-07-11 at 11-27-14 Calendar view - DEMO](https://github.com/r3-team/r3/assets/91060542/79f6a4c2-b7ec-4d15-85b7-b0992699bddf)

## :star: Features
* **Get going quickly**: Replace grown 'solutions' with a modern multi-user REI3 application, capabable of replacing even the most complex excel macros.
* **Make things visible**: Show tasks or events on Gantt planners, generate charts, display calendars or styled lists for quick access.
* **Build workflows**: Adjust forms based on the current state of a record, export to PDF or send notifications on update.
* **It can count**: Summarize records, do date calculations, apply business rules and much more.
* **Compliance tools**: With roles, access policies and triggers, REI3 can give and restrict access even on a per-record basis.
* **End-to-end encryption**: Built-in support for E2EE - easy to use with integrated key management features.
* **Integration options**: REI3 can serve as and connect to REST endpoints, create or import CSV files and even offer ICS for calendar access.
* **Ready for mobile**: REI3 interfaces work on mobile devices out-of-the-box but can be optimized to create apps with great usability. PWA features also enable native-like app experiences on mobile devices and PCs.
* **Fulltext search**: Users can quickly find desired content by using search phrases and language specific lookups.
* **Blazingly fast**: REI3 is built to take advantage of modern, multi-core processors and communicates with its clients over a bi-directional data connection for fast updates.
* **Security features**: Apply password policies, block brute-force attempts and enable MFA for your users.
* **Fully transparent**: Directly read and even change data in the REI3 database - everything is human-readable and accessible.
* **Selfhosted**: Run REI3 as you wish, locally or in the cloud - with full control on where your data is located.
* **Enterprise-ready**: Customize logos, texts and looks for your corporate environment. Grow REI3 with your organization by using clustering and connect to LDAP for authentication and authorization of users.

## :rocket: Quickstart
### Linux
1. Extract the REI3 package ([x64](https://rei3.de/latest/x64_linux)/[arm64](https://rei3.de/latest/arm64_linux)) to any location (like `/opt/rei3`) and make the binary `r3` executable (`chmod u+x r3`).
1. Copy the file `config_template.json` to `config.json` and fill in details to an empty, UTF8 encoded Postgres database. The DB user needs full permissions to this database.
1. Install optional dependencies - ImageMagick & Ghostscript for image and PDF thumbnails (`sudo apt install imagemagick ghostscript`), PostgreSQL client utilities for integrated backups (`sudo apt install postgresql-client`).
1. Register (`sudo ./r3 -install`) and start REI3 with your service manager (`sudo systemctl start rei3`).
### Windows
1. Setup the standalone version directly on any Windows Server with the [installer](https://rei3.de/latest/x64_installer).
1. Optionally, install [Ghostscript](https://www.ghostscript.com/) on the same Windows Server for PDF thumbnails.

Once running, REI3 is available at https://localhost (default port 443) with both username and password being `admin`. For the full documentation, visit [rei3.de](https://rei3.de/en/docs).

There are also Docker Compose files ([x64](https://rei3.de/docker_x64)/[arm64](https://rei3.de/docker_arm64)) and a [portable version](https://rei3.de/latest/x64_portable) for Windows available to quickly setup a test or development system.

## :bulb: Where to get help
You can visit our [community forum](https://community.rei3.de) for anything related to REI3. The full documentation is available on [rei3.de](https://rei3.de/en/docs), including documentation for [admins](https://rei3.de/en/docs/admin) and [application authors](https://rei3.de/en/docs/builder) as well as [Youtube videos](https://www.youtube.com/channel/UCKb1YPyUV-O4GxcCdHc4Csw).

## :clap: Thank you
REI3 would not be possible without the help of our contributors and people using and providing feedback for continous improvement. So thank you to everybody involved with the REI3 project!

[![Stargazers repo roster for @r3-team/r3](https://reporoster.com/stars/dark/r3-team/r3)](https://github.com/r3-team/r3/stargazers)

REI3 is built on-top of amazing open source software and technologies. Naming them all would take pages, but here are some core libraries and software that helped shape REI3:
* [Golang](https://golang.org/) to enable state-of-the-art web services and robust code even on multi-threaded systems.
* [PostgreSQL](https://www.postgresql.org/) for powerful features and the most reliable database management system we´ve ever had the pleasure to work with.
* [Vue.js](https://vuejs.org/) to provide stable and efficient frontend components and to make working with user interfaces fun.

## :+1: How to contribute
Contributions are always welcome - feel free to fork and submit pull requests.

REI3 follows a four-digit versioning syntax, such as `3.2.0.4246` (MAJOR.MINOR.PATCH.BUILD). The major release will stay at `3` indefinitely, while we introduce new features and database changes with each minor release. Patch releases primarily focus on fixes, but may include small features as long as the database is not changed.

The branch `main` will contain the currently released minor version of REI3; patches for this version can directly be submitted for the main branch. Each new minor release will use a separate branch, which will merge with `main` once the latest minor version is released.

## :nut_and_bolt: Build REI3 yourself
If you want to build REI3 itself, you can fork this repo or download the source code to build your own executable. The master branch contains the current minor release, while new minor releases are managed in new branches.

1. Install the latest version of [Golang](https://golang.org/dl/).
1. Go into the source code directory (where `r3.go` is located) and execute: `go build -ldflags "-X main.appVersion={YOUR_APP_VERSION}"`.
   * Replace `{YOUR_APP_VERSION}` with the version of the extracted source code. Example: `go build -ldflags "-X main.appVersion=2.5.1.2980"`
   * You can change the build version anytime. If you want to upgrade the major/minor version numbers however, you need to deal with upgrading the REI3 database (see `db/upgrade/upgrade.go`).
   * By setting the environment parameter `GOOS`, you can cross-compile for other systems (`GOOS=windows`, `GOOS=linux`, ...).
   * Static resource files (HTML, JS, CSS, etc.) are embedded into the binary during compilation - so changes to these files are only reflected after you recompile. Alternatively, you can use the `-wwwpath` command line argument to load REI3 with an external `www` directory, in which you can make changes directly.
1. Use your new, compiled binary of REI3 to replace an already installed one.
1. You are now running your own version of REI3.

## :page_with_curl: License
REI3 © 2019-2023 Gabriel Victor Herbert - released under the MIT license.
