MOS=mos

.PHONY: all build flash configure reboot

build:
	$(MOS) build

flash:
	$(MOS) flash

configure:
	$(MOS) wifi "${WIFI_SSID}" "${WIFI_PASS}"
	$(MOS) put combined.pem ca.pem
	$(MOS) config-set datadog.api_key="${DD_API_KEY}"
	$(MOS) config-set datadog.host_name="${DD_HOSTNAME}"
	$(MOS) config-set pins.voltage="${VOLTAGE_PIN}"

reboot:
	$(MOS) call Sys.Reboot

all: build flash configure reboot
