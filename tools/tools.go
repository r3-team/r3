package tools

import (
	"bytes"
	"math/rand"
	"strconv"
	"strings"
	"time"
)

func init() {
	// seed random number generator
	rand.Seed(time.Now().UnixNano())
}

func Substring(s string, start, end int) string {
	ctr, index0 := 0, 0
	for index1 := range s {
		if ctr == start {
			index0 = index1
		}
		if ctr == end {
			return s[index0:index1]
		}
		ctr++
	}
	return s[index0:]
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

func RandStringRunes(n int) string {
	var letterRunes = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")

	b := make([]rune, n)
	for i := range b {
		b[i] = letterRunes[rand.Intn(len(letterRunes))]
	}
	return string(b)
}
