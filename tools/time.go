package tools

import "time"

func GetTimeUnix() int64 {
	return time.Now().UTC().Unix()
}
func GetTimeUnixMilli() int64 {
	return time.Now().UTC().UnixNano() / int64(time.Millisecond)
}
func GetTimeSql() string {
	// 2006-01-02 15:04:05 has to be used to recognize format!
	return time.Now().UTC().Format("2006-01-02 15:04:05")
}
func GetTimeFromSql(sqlTime string) (time.Time, error) {
	t, err := time.Parse("2006-01-02 15:04:05", sqlTime)
	if err != nil {
		return t, err
	}
	return t, nil
}
