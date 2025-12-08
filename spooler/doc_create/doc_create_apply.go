package doc_create

import (
	"r3/types"

	"github.com/jackc/pgx/v5/pgtype"
)

func applyResolvedData(doc *doc, set []types.DocumentSet, setByData []types.DocumentSetByData) []types.DocumentSet {
	for _, o := range setByData {
		attributeIdMap, exists := doc.data[o.Index]
		if !exists {
			continue
		}
		value, exists := attributeIdMap[o.AttributeId]
		if !exists {
			continue
		}

		// type conversions
		switch v := value.(type) {
		case pgtype.Numeric:
			v1, err := v.Float64Value()
			if err == nil {
				value = v1.Float64
			}
		}

		// overwrite manual overwrite values
		overwroteExisting := false
		for i, s := range set {
			if s.Target == o.Target {
				set[i].Value = value
				overwroteExisting = true
				break
			}
		}

		// add overwrite value
		if !overwroteExisting {
			set = append(set, types.DocumentSet{
				Target: o.Target,
				Value:  value,
			})
		}
	}
	return set
}

func applyToDocument(set []types.DocumentSet, d types.Document) types.Document {
	for _, o := range set {
		switch v := o.Value.(type) {
		case string:
			switch o.Target {
			case "author":
				d.Author = v
			case "languageCode":
				d.LanguageCode = v
			case "title":
				d.Title = v
			}
		}
	}
	return d
}

func applyToField(set []types.DocumentSet, f types.DocumentField) types.DocumentField {
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

func applyToFieldList(set []types.DocumentSet, f types.DocumentFieldList) types.DocumentFieldList {
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
			case "footerBorder.color":
				f.FooterBorder.Color = v
			case "footerBorder.draw":
				f.FooterBorder.Draw = v
			case "footerColorFill":
				f.FooterColorFill = v
			case "bodyBorder.color":
				f.BodyBorder.Color = v
			case "bodyBorder.draw":
				f.BodyBorder.Draw = v
			case "bodyColorFillEven":
				f.BodyColorFillEven = v
			case "bodyColorFillOdd":
				f.BodyColorFillOdd = v
			case "headerBorder.color":
				f.HeaderBorder.Color = v
			case "headerBorder.draw":
				f.HeaderBorder.Draw = v
			case "headerColorFill":
				f.HeaderColorFill = v
			}
		}
	}
	return f
}

func applyToFont(set []types.DocumentSet, f types.DocumentFont) types.DocumentFont {
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
			case "font.formatDate":
				f.FormatDate = v
			case "font.family":
				f.Family = v
			case "font.style":
				f.Style = v
			}
		}
	}
	return f
}
