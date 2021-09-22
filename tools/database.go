package tools

import (
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/gofrs/uuid"
)

func CheckTableIds_tx(tx *sql.Tx, table string, ids []uint64) error {

	if len(ids) == 0 {
		return errors.New("cannot check empty table ID slice")
	}

	var resultCount int

	err := tx.QueryRow(fmt.Sprintf(`
		SELECT COUNT(*) FROM %s WHERE id IN (%s)
	`, table, SqlIntSeq(ids))).Scan(&resultCount)
	if err != nil {
		return err
	}
	if resultCount < len(ids) {
		return errors.New("found invalid IDs in table ID check")
	}
	return nil
}

// helper for SQL value placeholders, returns null string if value is ""
func SqlStringAsNull(in string) sql.NullString {
	if len(in) == 0 {
		return sql.NullString{}
	}
	return sql.NullString{
		String: in,
		Valid:  true,
	}
}

// helper for SQL value placeholders, returns null int64 if value is 0
func SqlInt64AsNull(in int64) sql.NullInt64 {
	if in == 0 {
		return sql.NullInt64{}
	}
	return sql.NullInt64{
		Int64: in,
		Valid: true,
	}
}

func SqlIntSeq(inputs []uint64) string {
	if len(inputs) == 0 {
		return "0"
	}

	b := []byte{}
	for _, input := range inputs {
		b = strconv.AppendInt(b, int64(input), 10)
		b = append(b, ',')
	}
	b = b[:len(b)-1]
	return string(b)
}

func SqlUuidSeq(inputs []uuid.UUID) string {
	if len(inputs) == 0 {
		return "'00000000-0000-0000-0000-000000000000'"
	}
	s := make([]string, 0)

	for _, uuidIn := range inputs {
		s = append(s, uuidIn.String())
	}
	return fmt.Sprintf("'%s'", strings.Join(s, "', '"))
}
