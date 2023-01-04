package tools

import (
	"bytes"
	"io/ioutil"
	"math/rand"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
)

func init() {
	// seed random number generator
	rand.Seed(time.Now().UnixNano())
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

func CheckCreateDir(dir string) error {
	exists, err := Exists(dir)

	if err != nil {
		return err
	}

	if !exists {
		if err := os.MkdirAll(dir, os.FileMode(0770)); err != nil {
			return err
		}
	}
	return nil
}
func CheckCreateFile(file string, templateFile string) error {
	exists, err := Exists(file)

	if err != nil {
		return err
	}

	if !exists {
		if err := FileCopy(templateFile, file, false); err != nil {
			return err
		}
	}
	return nil
}

func GetFileContents(filePath string, removeUtf8Bom bool) ([]byte, error) {

	output, err := ioutil.ReadFile(filePath)
	if err != nil {
		return []byte("{}"), err
	}
	if removeUtf8Bom {
		output = RemoveUtf8Bom(output)
	}
	return output, nil
}

func RemoveUtf8Bom(input []byte) []byte {
	return bytes.TrimPrefix(input, []byte("\xEF\xBB\xBF"))
}

func StringListToUInt64Array(input string) ([]uint64, error) {
	var output []uint64 = make([]uint64, 0)

	if len([]rune(input)) == 0 {
		return output, nil
	}

	list := strings.Split(input, ",")

	for _, value := range list {
		uint64Value, err := strconv.ParseUint(value, 10, 64)
		if err != nil {
			return output, err
		}
		output = append(output, uint64Value)
	}
	return output, nil
}

func StringInSlice(needle string, haystack []string) bool {
	for _, value := range haystack {
		if value == needle {
			return true
		}
	}
	return false
}

func IntInSlice(needle int, haystack []int) bool {
	for _, value := range haystack {
		if value == needle {
			return true
		}
	}
	return false
}

func Int64InSlice(needle int64, haystack []int64) bool {
	for _, value := range haystack {
		if value == needle {
			return true
		}
	}
	return false
}

func Uint64InSlice(needle uint64, haystack []uint64) bool {
	for _, value := range haystack {
		if value == needle {
			return true
		}
	}
	return false
}

func UuidInSlice(needle uuid.UUID, haystack []uuid.UUID) bool {
	for _, value := range haystack {
		if value == needle {
			return true
		}
	}
	return false
}

func UuidStringToNullUuid(input string) pgtype.UUID {
	id, err := uuid.FromString(input)
	out := pgtype.UUID{
		Bytes:  id,
		Status: pgtype.Present,
	}
	if err != nil {
		out.Status = pgtype.Null
	}
	return out
}

func RandStringRunes(n int) string {
	var letterRunes = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")

	b := make([]rune, n)
	for i := range b {
		b[i] = letterRunes[rand.Intn(len(letterRunes))]
	}
	return string(b)
}
