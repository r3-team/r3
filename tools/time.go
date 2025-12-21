package tools

import (
	"fmt"
	"time"
)

func GetDatetimeFormat(format string, withTime bool) string {
	s := "2006-01-02"
	switch format {
	case "Y-m-d":
		s = "2006-01-02"
	case "Y/m/d":
		s = "2006/01/02"
	case "d.m.Y":
		s = "02.01.2006"
	case "d/m/Y":
		s = "02/01/2006"
	case "m/d/Y":
		s = "01/02/2006"
	}

	if withTime {
		return fmt.Sprintf("%s %s", s, GetTimeFormat())
	}
	return s
}
func GetTimeFormat() string {
	return "15:04:05"
}
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
