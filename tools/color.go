package tools

import (
	"strconv"
	"strings"
)

func HexToInt(hex string) [3]int {
	if len(hex) != 6 {
		return [3]int{0, 0, 0}
	}
	hex = strings.ToLower(hex)
	r, err := strconv.ParseInt(hex[0:2], 16, 64)
	if err != nil {
		return [3]int{0, 0, 0}
	}
	g, err := strconv.ParseInt(hex[2:4], 16, 64)
	if err != nil {
		return [3]int{0, 0, 0}
	}
	b, err := strconv.ParseInt(hex[4:6], 16, 64)
	if err != nil {
		return [3]int{0, 0, 0}
	}
	return [3]int{int(r), int(g), int(b)}
}
