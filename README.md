# esp32-temp-js

This is a JS application which runs on an ESP32 device with Mongoose OS.

It will read a DS18B20 one-wire temperature sensor and emit the reading to Datadog.

## Setup

```sh
mos wifi SSID PASS
mos put combined-ca.pem ca.pem
mos config-set datadog.api_key=API_KEY
```

or

```sh
make configure
```

then

```sh
mos call Sys.Reboot
```
