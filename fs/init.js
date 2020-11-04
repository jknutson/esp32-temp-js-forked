load('api_adc.js');
load('api_arduino_onewire.js');
load('api_config.js');
load('api_gpio.js');
load('api_http.js');
load('api_net.js');
load('api_sys.js');
load('api_timer.js');
load('api_ds18b20.js');
// load('ds18b20.js');

let deviceId = Cfg.get('device.id');
let oneWirePin = Cfg.get('pins.temp');
let pollInterval = Cfg.get('interval') * 1000;
let deviceType = 'esp32';
let datadogApiKey = Cfg.get('datadog.api_key');

let ow = OneWire.create(oneWirePin);
let n = 0;
let rom = ['01234567'];

let searchSens = function() {
 let i = 0;
  ow.target_search(DEVICE_FAMILY.DS18B20);

  while (ow.search(rom[i], 0/* Normal search mode */) === 1) {
    if (rom[i][0].charCodeAt(0) !== DEVICE_FAMILY.DS18B20) {
      break;
    }
    // Sensor found
    rom[++i] = '01234567';
  }
  return i;
};

print('deviceId:', deviceId)
print('oneWirePint:', oneWirePin)

// temperature/humidity loop, 1000=1s,30000=30s,  60000=1m
Timer.set(pollInterval, true, function() {

  // temperature
  if (DS18B20.connected()) {
    let t = DS18B20.get();
    if (isNaN(t)) {
      print('could not read from device: ' + t);
      break;
    } else {
      let payload = {
        series: [
          {
            metric: 'w1_temperature.celcius.gauge',
            points: [[Timer.now(), t]],
            tags: ['device:' + deviceId, 'deviceType:' + deviceType],
            type: 'gauge'
          }
        ]
      };
      print('publishing: ' + JSON.stringify(payload))
      HTTP.query({
        url: 'https://api.datadoghq.com/api/v1/series?api_key=' + datadogApiKey,
        data: payload,
        success: function(body, full_http_msg) {
          print('datadog post success:', body);
        },
        error: function(err) {
          print('datadog post error:', err);
        }
      });
    }
  } else {
    print('no device found')
  }

  /*
  // humidity
  let relativeHumidity = ADC.read(humidPin);
  // TODO: this math most likely needs adjustment
  // see: http://www.instructables.com/id/HIH4000-Humidity-Hygrometer-Sensor-Tutorial/
  let av = 0.0048875 * relativeHumidity;
  let res = (av - 0.86) / 0.03;
  let ts = timestamp_ttl();
  let message = JSON.stringify({
    sensor: 'HIH4000',
    humidity: res,
    timestamp: ts[0],
    expires: ts[1],
    deviceId: deviceId,
    deviceType: deviceType,
    eventType: 'humidity'
  });
  let ok = MQTT.pub(topic, message, 1);
  print('Published:', ok, topic, '->', message)
  */

}, null);

/*
Net.setStatusEventHandler(function(ev, arg) {
  let evs = '???';
  if (ev === Net.STATUS_DISCONNECTED) {
    evs = 'DISCONNECTED';
  } else if (ev === Net.STATUS_CONNECTING) {
    evs = 'CONNECTING';
  } else if (ev === Net.STATUS_CONNECTED) {
    evs = 'CONNECTED';
  } else if (ev === Net.STATUS_GOT_IP) {
    evs = 'GOT_IP';
  }
  print('== Net event:', ev, evs, arg);
}, null);
*/
