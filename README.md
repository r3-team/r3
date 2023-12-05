![r3_logo_git](https://github.com/r3-team/r3/assets/91060542/a759e7ec-e1a0-4a4e-a426-509abc764352)
<h1 align="center">REI3</h1>
<p align="center"><strong>Free and open low code</strong><br />Build and host powerful applications with full control and ownership</p>

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
<p align="center">
	<a href="https://demo.rei3.de/" target="_blank">Live demo</a>
	-
	<a href="https://rei3.de/en/news" target="_blank">News</a>
	-
	<a href="https://rei3.de/en/downloads" target="_blank">Downloads</a>
	-
	<a href="https://rei3.de/en/docs" target="_blank">Documentation</a>
	-
	<a href="https://rei3.de/en/applications" target="_blank">Applications</a>
</p>

<p align="center">Free yourself from walled gardens and cloud-only SaaS offerings. REI3 enables powerful low code applications, selfhosted in the cloud or on-premise. Create and then use, share or even sell your REI3 applications.</p>

![DEMO - Orgas](https://github.com/r3-team/r3/assets/91060542/77596cf1-5ea8-4130-999d-bbd4aa782535)
![DEMO - Gantt](https://github.com/r3-team/r3/assets/91060542/3c103e67-6e48-4fc6-b99a-9dfcde00bba7)

## :star: Features
* **Fast results**: Quickly replace grown, spreadsheet based 'solutions' with proper multi-user applications.
* **It can count**: Summarize records, do date calculations, apply business rules and much more.
* **Make things visible**: Show tasks on Gantt charts, generate diagrams or display information-dense lists.
* **Workflows included**: Adjust forms based on the current state of a record, export to PDF or send notifications.
* **Compliance tools**: With roles and access policies, REI3 can give and restrict access even on a per-record basis.
* **End-to-end encryption**: Built-in support for E2EE - easy to use with integrated key management features.
* **Integration options**: REI3 can serve as and connect to REST endpoints, create or import CSV files and also includes ICS access for regularly updating calendars on devices.
* **Ready for mobile**: Works well on all devices, with specific mobile settings and PWA features for great-feeling apps.
* **Fulltext search**: Users can quickly find desired content by using search phrases and language specific lookups.
* **Blazingly fast**: REI3 is built to take advantage of multi-core processors and communicates with clients over bi-directional data channels.
* **Security features**: Apply password policies, block brute-force attempts and enable MFA for your users.
* **Fully transparent**: Directly read and even change data in the REI3 database - everything is human-readable.
* **Selfhosted**: Run REI3 as you wish, locally or in the cloud - with full control on where your data is located.
* **Enterprise-ready**: Adjust REI3 to your corporate identity, manage users & access via LDAP and grow with your organization by extending applications and clustering REI3.

![DEMO - Calendar](https://github.com/r3-team/r3/assets/91060542/9aaad47b-fadf-4ed1-a07a-ca9ceb01e548)
![DEMO - Assets](https://github.com/r3-team/r3/assets/91060542/36ea11cc-7c81-43ad-84c8-4722857e0d01)

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
REI3 would not be possible without the help of our contributors and people using REI3 and providing feedback for continous improvement. So thank you to everybody involved with the REI3 project!

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
1. You can now start your own REI3 version. Make sure to clear all browser caches after creating/updating your own version.

## :page_with_curl: License
REI3 © 2019-2023 Gabriel Victor Herbert - released under the MIT license.
