package cache

import (
	"r3/schema/field"
	"r3/types"
	"sync"

	"github.com/gofrs/uuid"
)

var (
	ics_mx        sync.Mutex
	fieldIdMapIcs = make(map[uuid.UUID]types.FieldCalendar)
)

func GetCalendarField(fieldId uuid.UUID) (types.FieldCalendar, error) {
	ics_mx.Lock()
	defer ics_mx.Unlock()

	f, exists := fieldIdMapIcs[fieldId]
	if exists {
		return f, nil
	}

	f, err := field.GetCalendar(fieldId)
	if err != nil {
		return f, err
	}
	fieldIdMapIcs[f.Id] = f
	return f, nil
}

func renewIcsFields() {
	ics_mx.Lock()
	defer ics_mx.Unlock()

	fieldIdMapIcs = make(map[uuid.UUID]types.FieldCalendar)
}
