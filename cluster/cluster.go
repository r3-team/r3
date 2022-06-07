package cluster

import (
	"encoding/json"
	"r3/cache"
	"r3/db"
)

var (
	websocketClientCount int
)

func SetWebsocketClientCount(value int) {
	websocketClientCount = value
}

// helper
func createEventsForOtherNodes(content string, payload interface{}) error {
	payloadJson, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	_, err = db.Pool.Exec(db.Ctx, `
		INSERT INTO instance_cluster.node_event (node_id, content, payload)
		SELECT id, $1, $2
		FROM instance_cluster.node
		WHERE id <> $3
	`, content, payloadJson, cache.GetNodeId())

	return err
}
