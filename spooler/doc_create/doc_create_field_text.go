package doc_create

import (
	"fmt"
	"r3/tools"
	"r3/types"
	"strings"
	"time"
)

func addFieldText(doc *doc, f types.DocFieldText, font types.DocFont, flowHorizontal bool) error {

	f.Value = strings.ReplaceAll(f.Value, "{PAGE_END}", "{nb}")
	f.Value = strings.ReplaceAll(f.Value, "{PAGE_CUR}", fmt.Sprintf("%d", doc.p.PageNo()))
	f.Value = strings.ReplaceAll(f.Value, "{DATE_TODAY}", time.Now().Local().Format(tools.GetDatetimeFormat(font.DateFormat, false)))
	f.Value = strings.ReplaceAll(f.Value, "{DATETIME_NOW}", time.Now().Local().Format(tools.GetDatetimeFormat(font.DateFormat, true)))
	f.Value = strings.ReplaceAll(f.Value, "{TIME_NOW}", time.Now().Local().Format(tools.GetTimeFormat()))

	drawCellText(doc, font, f.SizeX, 0, flowHorizontal, 0, f.Value)
	return nil
}
