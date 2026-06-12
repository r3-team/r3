package column

import (
	"context"
	"errors"
	"fmt"
	"r3/schema"
	"r3/schema/caption"
	"r3/schema/compatible"
	"r3/schema/query"
	"r3/types"
	"slices"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `DELETE FROM app.column WHERE id = $1`, id)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, entity schema.DbEntity, entityId uuid.UUID) ([]types.Column, error) {

	if !slices.Contains(schema.DbAssignedColumn, entity) {
		return nil, errors.New("bad entity")
	}

	rows, err := tx.Query(ctx, fmt.Sprintf(`
		SELECT id, content, pg_function_id_call, attribute_id, index, batch, basis, length, display,
			group_by, aggregator, scalar_function, distincted, hidden, on_mobile, styles
		FROM app.column
		WHERE %s_id = $1
		ORDER BY position ASC
	`, entity), entityId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := make([]types.Column, 0)
	for rows.Next() {
		var c types.Column
		if err := rows.Scan(&c.Id, &c.Content, &c.PgFunctionId, &c.AttributeId, &c.Index, &c.Batch,
			&c.Basis, &c.Length, &c.Display, &c.GroupBy, &c.Aggregator, &c.Scalar, &c.Distincted,
			&c.Hidden, &c.OnMobile, &c.Styles); err != nil {

			return nil, err
		}
		columns = append(columns, c)
	}
	rows.Close()

	for i, c := range columns {
		if c.Content == schema.ColumnContentQuery {
			c.Query, err = query.Get_tx(ctx, tx, schema.DbColumn, c.Id, 0, 0, 0)
			if err != nil {
				return nil, err
			}
		} else {
			c.Query.RelationId = pgtype.UUID{}
		}

		c.Captions, err = caption.Get_tx(ctx, tx, schema.DbColumn, c.Id, []string{"columnTitle"})
		if err != nil {
			return nil, err
		}

		if c.PgFunctionId.Valid || c.Scalar.Valid {
			c.Arguments, err = getArguments_tx(ctx, tx, c.Id)
			if err != nil {
				return nil, err
			}
		} else {
			c.Arguments = make([]types.ColumnArg, 0)
		}
		columns[i] = c
	}
	return columns, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, entity schema.DbEntity, entityId uuid.UUID, columns []types.Column) error {

	if !slices.Contains(schema.DbAssignedColumn, entity) {
		return errors.New("bad entity")
	}

	// delete removed columns
	idsKeep := make([]uuid.UUID, 0)
	for _, c := range columns {
		idsKeep = append(idsKeep, c.Id)
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		DELETE FROM app.column
		WHERE %s_id = $1
		AND id <> ALL($2)
	`, entity), entityId, idsKeep); err != nil {
		return err
	}

	// insert new/update existing columns
	for position, c := range columns {

		// fix imports < 3.3: Migrate display option to attribute content use
		var err error
		c.Display, err = compatible.MigrateDisplayToContentUse_tx(ctx, tx, c.AttributeId, c.Display)
		if err != nil {
			return err
		}

		// fix imports < 3.8: Convert to new styles
		c = compatible.FixColumnStyles(c)

		// fix imports < 3.13: Set empty content
		c = compatible.FixMissingColumnContent(c)

		if _, err := tx.Exec(ctx, fmt.Sprintf(`
			INSERT INTO app.column (
				id, %s_id, content, pg_function_id_call, attribute_id, index, position, batch, basis, length, display,
				group_by, aggregator, scalar_function, distincted, hidden, on_mobile, styles
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
			ON CONFLICT (id)
			DO UPDATE SET content = $3, pg_function_id_call = $4, attribute_id = $5, index = $6, position = $7, batch = $8,
				basis = $9, length = $10, display = $11, group_by = $12, aggregator = $13, scalar_function = $14, distincted = $15,
				hidden = $16, on_mobile = $17, styles = $18
		`, entity), c.Id, entityId, c.Content, c.PgFunctionId, c.AttributeId, c.Index, position, c.Batch, c.Basis,
			c.Length, c.Display, c.GroupBy, c.Aggregator, c.Scalar, c.Distincted, c.Hidden, c.OnMobile, c.Styles); err != nil {

			return err
		}
		if c.Content == schema.ColumnContentQuery {
			if err := query.Set_tx(ctx, tx, schema.DbColumn, c.Id, 0, 0, 0, c.Query); err != nil {
				return err
			}
		}
		if c.Content == schema.ColumnContentFncPg || c.Content == schema.ColumnContentFncScalar {
			if err := setArguments_tx(ctx, tx, c.Id, c.Arguments); err != nil {
				return err
			}
		} else {
			if err := delArguments_tx(ctx, tx, c.Id); err != nil {
				return err
			}
		}
		if err := caption.Set_tx(ctx, tx, c.Id, c.Captions); err != nil {
			return err
		}
	}
	return nil
}
