package types

type WebsocketClientDevice int

var (
	WebsocketClientDeviceBrowser   WebsocketClientDevice = 1
	WebsocketClientDeviceFatClient WebsocketClientDevice = 2

	WebsocketClientDeviceNames = map[WebsocketClientDevice]string{
		WebsocketClientDeviceBrowser:   "browser",
		WebsocketClientDeviceFatClient: "fatClient",
	}
)
