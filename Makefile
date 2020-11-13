MOS=mos

build:
	$(MOS) build

flash:
	$(MOS) flash

configure:
	$(MOS) wifi "${WIFI_SSID}" "${WIFI_PASS}"
	$(MOS) put combined.pem ca.pem
	$(MOS) config-set datadog.api_key="${DD_API_KEY}"

reboot:
	$(MOS) call Sys.Reboot

all: build flash configure reboot
