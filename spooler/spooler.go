package spooler

import (
	"context"
	"fmt"
	"r3/cache"
	"r3/db"
	"strings"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func ExecutePgFunction(ctx context.Context, pgFunctionId uuid.UUID, args []any, frontendCall bool) (any, error) {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	returnIf, err := ExecutePgFunction_tx(ctx, tx, pgFunctionId, args, frontendCall)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return returnIf, nil
}

func ExecutePgFunction_tx(ctx context.Context, tx pgx.Tx, pgFunctionId uuid.UUID, args []any, frontendCall bool) (any, error) {

	modName, fncName, err := cache.GetPgFunctionDbNames(pgFunctionId, frontendCall)
	if err != nil {
		return nil, err
	}

	placeholders := make([]string, len(args))
	for i := range args {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
	}

	var returnIf any
	if err := tx.QueryRow(ctx, fmt.Sprintf(`SELECT "%s"."%s"(%s)`, modName, fncName, strings.Join(placeholders, ",")), args...).Scan(&returnIf); err != nil {
		return nil, err
	}
	return returnIf, nil
}
