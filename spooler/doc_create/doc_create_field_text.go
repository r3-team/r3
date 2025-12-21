package doc_create

import (
	"fmt"
	"r3/tools"
	"r3/types"
	"strings"
	"time"
)

func addFieldText(doc *doc, f types.DocumentFieldText, w float64, b types.DocumentBorder, font types.DocumentFont) (float64, error) {

	// replace known document placeholders ({PAGE_END} is set by fpdf)
	f.Value = strings.ReplaceAll(f.Value, "{PAGE_CUR}", fmt.Sprintf("%d", doc.p.PageNo()))
	f.Value = strings.ReplaceAll(f.Value, "{DATE_TODAY}", time.Now().Local().Format(tools.GetDatetimeFormat(font.FormatDate, false)))
	f.Value = strings.ReplaceAll(f.Value, "{DATETIME_NOW}", time.Now().Local().Format(tools.GetDatetimeFormat(font.FormatDate, true)))
	f.Value = strings.ReplaceAll(f.Value, "{TIME_NOW}", time.Now().Local().Format(tools.GetTimeFormat()))

	drawCellText(doc, b, font, w, -1, -1, f.Value)
	return doc.p.GetY(), nil
}
