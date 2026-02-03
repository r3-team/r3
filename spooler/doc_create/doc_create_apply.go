package doc_create

import (
	"r3/types"

	"github.com/jackc/pgx/v5/pgtype"
)

func applyToDocument(set []types.DocSet, d types.Doc) types.Doc {
	// order is relevant here, language code must be set before title
	for _, o := range set {
		switch v := o.Value.(type) {
		case string:
			switch o.Target {
			case "author":
				d.Author = v
			case "filename":
				d.Filename = v
			case "language":
				d.Language = v
			case "title":
				if _, exists := d.Captions["docTitle"]; !exists {
					d.Captions["docTitle"] = make(map[string]string)
				}
				d.Captions["docTitle"][d.Language] = v
			}
		}
	}
	return d
}

func applyToColumn(set []types.DocSet, c types.DocColumn) types.DocColumn {
	for _, o := range set {
		switch v := o.Value.(type) {
		case float64:
			switch o.Target {
			case "text.length":
				c.Length = int(v)
			}
		case int32:
			switch o.Target {
			case "text.length":
				c.Length = int(v)
			}
		case int64:
			switch o.Target {
			case "text.length":
				c.Length = int(v)
			}
		case string:
			switch o.Target {
			case "text.postfix":
				c.TextPostfix = v
			case "text.prefix":
				c.TextPrefix = v
			}
		}
	}
	return c
}

func applyToFieldData(set []types.DocSet, f types.DocFieldData) types.DocFieldData {
	for _, o := range set {
		switch v := o.Value.(type) {
		case float64:
			switch o.Target {
			case "text.length":
				f.Length = int(v)
			}
		case int32:
			switch o.Target {
			case "text.length":
				f.Length = int(v)
			}
		case int64:
			switch o.Target {
			case "text.length":
				f.Length = int(v)
			}
		case string:
			switch o.Target {
			case "text.postfix":
				f.TextPostfix = v
			case "text.prefix":
				f.TextPrefix = v
			}
		}
	}
	return f
}

func applyToFieldGrid(set []types.DocSet, f types.DocFieldGrid) types.DocFieldGrid {
	for _, o := range set {
		switch v := o.Value.(type) {
		case float64:
			switch o.Target {
			case "border.size":
				f.Border.Size = v
			}
		case string:
			switch o.Target {
			case "border.color":
				f.Border.Color = pgtype.Text{String: v, Valid: true}
			case "border.draw":
				f.Border.Draw = v
			}
		}
	}
	return f
}

func applyToFieldFlow(set []types.DocSet, f types.DocFieldFlow) types.DocFieldFlow {
	for _, o := range set {
		switch v := o.Value.(type) {
		case float64:
			switch o.Target {
			case "border.size":
				f.Border.Size = v
			}
		case string:
			switch o.Target {
			case "border.color":
				f.Border.Color = pgtype.Text{String: v, Valid: true}
			case "border.draw":
				f.Border.Draw = v
			}
		}
	}
	return f
}

func applyToFieldList(set []types.DocSet, f types.DocFieldList) types.DocFieldList {
	for _, o := range set {
		switch v := o.Value.(type) {
		case bool:
			switch o.Target {
			case "bodyBorder.cell":
				f.BodyBorder.Cell = v
			case "footerBorder.cell":
				f.FooterBorder.Cell = v
			case "headerBorder.cell":
				f.HeaderBorder.Cell = v
			case "headerRow.show":
				f.HeaderRowShow = v
			case "headerRow.repeat":
				f.HeaderRowRepeat = v
			}
		case float64:
			switch o.Target {
			case "bodyBorder.size":
				f.BodyBorder.Size = v
			case "footerBorder.size":
				f.FooterBorder.Size = v
			case "headerBorder.size":
				f.HeaderBorder.Size = v
			}
		case string:
			switch o.Target {
			case "bodyBorder.color":
				f.BodyBorder.Color = pgtype.Text{String: v, Valid: true}
			case "bodyBorder.draw":
				f.BodyBorder.Draw = v
			case "bodyRow.colorFillEven":
				f.BodyRowColorFillEven = pgtype.Text{String: v, Valid: true}
			case "bodyRow.colorFillOdd":
				f.BodyRowColorFillOdd = pgtype.Text{String: v, Valid: true}
			case "footerBorder.color":
				f.FooterBorder.Color = pgtype.Text{String: v, Valid: true}
			case "footerBorder.draw":
				f.FooterBorder.Draw = v
			case "footerRow.colorFill":
				f.FooterRowColorFill = pgtype.Text{String: v, Valid: true}
			case "headerBorder.color":
				f.HeaderBorder.Color = pgtype.Text{String: v, Valid: true}
			case "headerBorder.draw":
				f.HeaderBorder.Draw = v
			case "headerRow.colorFill":
				f.HeaderRowColorFill = pgtype.Text{String: v, Valid: true}
			}
		}
	}
	return f
}

func applyToFont(set []types.DocSet, f types.DocFont) types.DocFont {
	for _, o := range set {
		switch v := o.Value.(type) {
		case float64:
			switch o.Target {
			case "font.lineFactor":
				f.LineFactor = v
			case "font.size":
				f.Size = v
			}
		case string:
			switch o.Target {
			case "font.align":
				f.Align = v
			case "font.color":
				f.Color = pgtype.Text{String: v, Valid: true}
			case "font.dateFormat":
				f.DateFormat = v
			case "font.family":
				f.Family = v
			case "font.numberSepDec":
				f.NumberSepDec = v
			case "font.numberSepTho":
				f.NumberSepTho = v
			case "font.style":
				f.Style = pgtype.Text{String: v, Valid: true}
			}
		}
	}
	return f
}
