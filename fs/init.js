load('api_config.js');
load('api_gpio.js');
load('api_mqtt.js');
load('api_net.js');
load('api_sys.js');
load('api_timer.js');
load('api_adc.js');
load('api_arduino_onewire.js');
load('ds18b20.js');

let timeFormat = '%FT%T%z';
// TODO make configs work
// let doorPin = 34;
let doorPin = 4;
let doorPinNO = 16;
let oneWirePin = 14;
let builtinPin = 0;
let humidPin = 33;
let deviceId = Cfg.get('device.id');
let deviceType = 'esp32';
let topic = '/devices/' + deviceId + '/events';
let ttl = 604800; // one week in seconds

let ow = OneWire.create(oneWirePin);
let n = 0;
let rom = ['01234567'];

GPIO.set_mode(doorPin, GPIO.MODE_INPUT);
GPIO.set_mode(doorPinNO, GPIO.MODE_INPUT);

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

let timestamp = function() {
  return Timer.fmt(timeFormat, Timer.now());
};

let timestamp_ttl = function() {
  let now = Timer.now();
  return [Timer.fmt(timeFormat, Timer.now()), now + ttl];
};

let getInfo = function() {
  return JSON.stringify({
    total_ram: Sys.total_ram(),
    free_ram: Sys.free_ram()
  });
};

// temperature/humidity loop, 1000=1s,30000=30s,  60000=1m
Timer.set(1000, true, function() {

  // temperature
  if (n === 0) {
    if ((n = searchSens()) === 0) {
      print('No device found');
    }
  }
  for (let i = 0; i < n; i++) {
    let t = getTemp(ow, rom[i]);
    if (isNaN(t)) {
      print('No device found');
      break;
    } else {
      let ts = timestamp_ttl();
      let f_t = t * 9 / 5 + 32;
      let message = JSON.stringify({
        sensor: i,
        temperature: {
          fahrenheit: f_t,
          celcius: t
        },
        timestamp: ts[0],
        expires: ts[1],
        deviceId: deviceId,
        deviceType: deviceType,
        eventType: 'temperature'
      });
      let ok = MQTT.pub(topic, message, 1);
      print('Published:', ok, topic, '->', message)
    }
  }

  // humidity
  let enableAnalog = ADC.enable(humidPin);
  let relativeHumidity = ADC.read(humidPin);
  // TODO: this math most likely needs adjustment
  // see: http://www.instructables.com/id/HIH4000-Humidity-Hygrometer-Sensor-Tutorial/
  let av = 0.0048875*relativeHumidity;
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

}, null);

Timer.set(1000 , true , function() {
  let doorStatus = GPIO.read(doorPin);
  let ts = timestamp_ttl();
  let message = JSON.stringify({
    doorStatus: doorStatus,
    pin: doorPin,
    timestamp: ts[0],
    expires: ts[1],
    deviceId: deviceId,
    deviceType: deviceType,
    eventType: 'door'
  });
  let ok = MQTT.pub(topic, message, 1);
  print('Published:', ok, topic, '->', message)
}, null);


GPIO.set_button_handler(doorPin, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 1000, function(x) {
  let doorStatus = GPIO.read(doorPin);
  let ts = timestamp_ttl();
  let message = JSON.stringify({
    doorStatus: doorStatus,
    pin: x,
    timestamp: ts[0],
    expires: ts[1],
    deviceId: deviceId,
    deviceType: deviceType,
    eventType: 'doorEvent'
  });
  let ok = MQTT.pub(topic, message, 1);
  print('Published:', ok, topic, '->', message);
}, null);

// this isnt working, need some schematics help with my inverter
// GPIO.set_button_handler(doorPinNO, GPIO.PULL_DOWN, GPIO.INT_EDGE_NEG, 200, function(x) {
//   let doorStatus = GPIO.read(doorPinNO);
//   let message = JSON.stringify({
//     doorStatus: doorStatus,
//     pin: x,
//     timestamp: ts[0],
//     deviceId: deviceId,
//     deviceType: deviceType,
//     eventType: 'doorEvent',
//     eventValue: 'doorOpened'
//   });
//   let ok = MQTT.pub(topic, message, 1);
//   print('Published:', ok, topic, '->', message);
// }, null);


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
  print('== Net event:', ev, evs);
}, null);
