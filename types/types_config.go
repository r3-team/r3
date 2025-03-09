package types

type Version struct {
	Build int    // build number of version (1023)
	Cut   string // major+minor version (1.2), should match DB version (1.2), which is kept to the same major+minor as app
	Full  string // full version (1.2.0.1023), syntax: major.minor.patch.build
}

type FileType struct {
	Cluster struct {
		NodeId string `json:"nodeId"`
	} `json:"cluster"`

	Db FileTypeDb `json:"db"`

	Paths struct {
		Certificates   string `json:"certificates"`
		EmbeddedDbBin  string `json:"embeddedDbBin"`
		EmbeddedDbData string `json:"embeddedDbData"`
		Files          string `json:"files"`
		Temp           string `json:"temp"`
		Transfer       string `json:"transfer"`
	} `json:"paths"`

	Portable bool `json:"portable"`

	Web struct {
		Cert          string `json:"cert"`
		Key           string `json:"key"`
		Listen        string `json:"listen"`
		Port          int    `json:"port"`
		TlsMinVersion string `json:"tlsMinVersion"`
	} `json:"web"`
}

type FileTypeDb struct {
	Host string `json:"host"`
	Port int    `json:"port"`
	Name string `json:"name"`
	User string `json:"user"`
	Pass string `json:"pass"`

	// use embedded database
	Embedded bool `json:"embedded"`

	// SSL/TLS settings
	Ssl           bool `json:"ssl"`
	SslSkipVerify bool `json:"sslSkipVerify"`

	// connection settings
	ConnsMax int32 `json:"connsMax"` // ignore if 0
	ConnsMin int32 `json:"connsMin"` // ignore if 0
}
