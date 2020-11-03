MOS=mos

configure:
	$(MOS) wifi "${WIFI_SSID}" "${WIFI_PASS}" && $(MOS) put combined.pem ca.pem && $(MOS) call Sys.Reboot
