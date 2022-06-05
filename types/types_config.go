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

	Web struct {
		Cert   string `json:"cert"`
		Key    string `json:"key"`
		Listen string `json:"listen"`
		Port   int    `json:"port"`
	} `json:"web"`
}

type FileTypeDb struct {
	Embedded bool   `json:"embedded"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Name     string `json:"name"`
	User     string `json:"user"`
	Pass     string `json:"pass"`
}
