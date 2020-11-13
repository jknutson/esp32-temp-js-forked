load('api_adc.js');
load('api_arduino_onewire.js');
load('api_config.js');
load('api_gpio.js');
load('api_http.js');
load('api_net.js');
load('api_timer.js');
load('api_sys.js');
load('api_ds18b20.js');

let deviceId = Cfg.get('device.id');
let deviceType = 'esp32';
let metricTags = ['device:' + deviceId, 'deviceType:' + deviceType];
let oneWirePin = Cfg.get('pins.temp');
let buttonPin = 0;  // builtin
let pollInterval = Cfg.get('interval') * 1000;
let datadogApiKey = Cfg.get('datadog.api_key');

let ow = OneWire.create(oneWirePin);
let n = 0;
let rom = ['01234567'];

print('deviceId:', deviceId)
print('oneWirePin:', oneWirePin)

let postMetric = function(datadogApiKey, payload) {
  print('publishing: ' + JSON.stringify(payload))
  HTTP.query({
    url: 'https://api.datadoghq.com/api/v1/series?api_key=' + datadogApiKey,
    data: payload,
    success: function(body, full_http_msg) {
      print('datadog post metric success:', body);
    },
    error: function(err) {
      print('datadog post metric error:', err);
    }
  });
};

GPIO.set_button_handler(buttonPin, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 50, function(x) {
  let buttonPinString = JSON.stringify(buttonPin);
  // TODO: list sensors and include in event payload, plus any other debugging info?
  let payload = JSON.stringify({
    text: 'button on pin ' + buttonPinString + ' was pressed',
    title: 'esp32 device button pressed',
    device_name: deviceId,
    host: deviceId,
    tags: [
      'device:' + deviceId,
      'deviceType:' + deviceType,
      'buttonPin:' + buttonPinString
    ]
  });

  HTTP.query({
    url: 'https://api.datadoghq.com/api/v1/events?api_key=' + datadogApiKey,
    data: payload,
    success: function(body, full_http_msg) {
      print('datadog post event success:', body);
    },
    error: function(err) {
      print('datadog post event error:', err);
    }
  });
}, null);


Timer.set(pollInterval, true, function() {
  let totalRam = Sys.total_ram();
  let freeRam = Sys.free_ram();

  let now = Timer.now();
  let sysPayload = {
    series: [
      {
        metric: 'mos.sys.total_ram',
        points: [[now, totalRam]],
        tags: metricTags,
        type: 'gauge'
      },
      {
        metric: 'mos.sys.free_ram',
        points: [[now, freeRam]],
        tags: metricTags,
        type: 'gauge'
      }
    ]
  };
  print('publishing: ' + JSON.stringify(sysPayload))
  postMetric(datadogApiKey, sysPayload);

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
            tags: metricTags,
            type: 'gauge'
          }
        ]
      };
      print('publishing: ' + JSON.stringify(payload))
      postMetric(datadogApiKey, payload);
    }
  } else {
    print('no oneWire device found')
  }
}, null);
