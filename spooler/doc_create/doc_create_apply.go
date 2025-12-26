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
			case "languageCode":
				d.LanguageCode = v
			case "title":
				if _, exists := d.Captions["docTitle"]; !exists {
					d.Captions["docTitle"] = make(map[string]string)
				}
				d.Captions["docTitle"][d.LanguageCode] = v
			}
		}
	}
	return d
}

func applyToField(set []types.DocSet, f types.DocField) types.DocField {
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
				f.Border.Color = v
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
			case "headerRepat":
				f.HeaderRepeat = v
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
				f.BodyBorder.Color = v
			case "bodyBorder.draw":
				f.BodyBorder.Draw = v
			case "bodyColorFillEven":
				f.BodyColorFillEven = pgtype.Text{String: v, Valid: true}
			case "bodyColorFillOdd":
				f.BodyColorFillOdd = pgtype.Text{String: v, Valid: true}
			case "footerBorder.color":
				f.FooterBorder.Color = v
			case "footerBorder.draw":
				f.FooterBorder.Draw = v
			case "footerColorFill":
				f.FooterColorFill = pgtype.Text{String: v, Valid: true}
			case "headerBorder.color":
				f.HeaderBorder.Color = v
			case "headerBorder.draw":
				f.HeaderBorder.Draw = v
			case "headerColorFill":
				f.HeaderColorFill = pgtype.Text{String: v, Valid: true}
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
				f.Color = v
			case "font.dateFormat":
				f.DateFormat = v
			case "font.family":
				f.Family = v
			case "font.numberSepDec":
				f.NumberSepDec = v
			case "font.numberSepTho":
				f.NumberSepTho = v
			case "font.style":
				f.Style = v
			}
		}
	}
	return f
}
