package cluster

import (
	"r3/types"

	"github.com/gofrs/uuid"
)

func DeviceBrowserApplyCopiedFiles(updateNodes bool, address string, loginId int64,
	attributeId uuid.UUID, fileIds []uuid.UUID, recordId int64) error {

	target := types.ClusterEventTarget{Address: address, Device: types.WebsocketClientDeviceBrowser, LoginId: loginId}
	payload := types.ClusterEventDeviceBrowserApplyCopiedFiles{
		AttributeId: attributeId,
		FileIds:     fileIds,
		RecordId:    recordId,
	}

	if updateNodes {
		if err := createEventsForOtherNodes("filesCopied", payload, target); err != nil {
			return err
		}
	}
	WebsocketClientEvents <- types.ClusterEvent{
		Content: "deviceBrowserApplyCopiedFiles",
		Payload: payload,
		Target:  target,
	}
	return nil
}
func DeviceBrowserCallJsFunction(updateNodes bool, address string, loginId int64, jsFunctionId uuid.UUID, arguments []interface{}) error {

	target := types.ClusterEventTarget{Address: address, Device: types.WebsocketClientDeviceBrowser, LoginId: loginId}
	payload := types.ClusterEventDeviceBrowserCallJsFunction{
		JsFunctionId: jsFunctionId,
		Arguments:    arguments,
	}

	if updateNodes {
		if err := createEventsForOtherNodes("jsFunctionCalled", payload, target); err != nil {
			return err
		}
	}
	WebsocketClientEvents <- types.ClusterEvent{
		Content: "deviceBrowserCallJsFunction",
		Payload: payload,
		Target:  target,
	}
	return nil
}
func DeviceFatClientRequestFile(updateNodes bool, address string, loginId int64, attributeId uuid.UUID,
	fileId uuid.UUID, fileHash string, fileName string, chooseApp bool) error {

	target := types.ClusterEventTarget{Address: address, Device: types.WebsocketClientDeviceFatClient, LoginId: loginId}
	payload := types.ClusterEventDeviceFatClientRequestFile{
		AttributeId: attributeId,
		ChooseApp:   chooseApp,
		FileId:      fileId,
		FileHash:    fileHash,
		FileName:    fileName,
	}

	if updateNodes {
		if err := createEventsForOtherNodes("fileRequested", payload, target); err != nil {
			return err
		}
	}
	WebsocketClientEvents <- types.ClusterEvent{
		Content: "deviceFatClientRequestFile",
		Payload: payload,
		Target:  target,
	}
	return nil
}
