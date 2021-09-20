package types

type License struct {
	LicenseId     string `json:"licenseId"`
	ClientId      string `json:"clientId"`
	RegisteredFor string `json:"registeredFor"`
	ValidUntil    int64  `json:"validUntil"`
}

type LicenseFile struct {
	License   License `json:"license"`
	Signature string  `json:"signature"`
}
