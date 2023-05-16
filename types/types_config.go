package types

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
		Cert   string `json:"cert"`
		Key    string `json:"key"`
		Listen string `json:"listen"`
		Port   int    `json:"port"`
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
}
