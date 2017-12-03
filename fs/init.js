load('api_config.js');
load('api_gpio.js');
load('api_mqtt.js');
load('api_net.js');
load('api_sys.js');
load('api_timer.js');
load("api_adc.js");
load('api_arduino_onewire.js');
load('ds18b20.js');

let timeFormat = '%FT%T%z';
let doorPin = Cfg.get('pins.door');
let oneWirePin = Cfg.get('pins.temp');
let builtinPin = Cfg.get('pins.builtin');
print(doorPin);
print(oneWirePin);
print(builtinPin);
let doorPin = 34;
let oneWirePin = 14;
let builtinPin = 0;
let humidPin = 33;
let topic = '/devices/' + Cfg.get('device.id') + '/events';

// Initialize OneWire library
let ow = OneWire.create(oneWirePin);
// Number of sensors found on the 1-Wire bus
let n = 0;
// Sensors addresses
let rom = ['01234567'];

// Search for sensors
let searchSens = function() {
  let i = 0;
  // Setup the search to find the device type on the next call
  // to search() if it is present.
  ow.target_search(DEVICE_FAMILY.DS18B20);

  while (ow.search(rom[i], 0/* Normal search mode */) === 1) {
    // If no devices of the desired family are currently on the bus, 
    // then another type will be found. We should check it.
    if (rom[i][0].charCodeAt(0) !== DEVICE_FAMILY.DS18B20) {
      break;
    }
    // Sensor found
    print('Sensor#', i, 'address:', toHexStr(rom[i]));
    rom[++i] = '01234567';
  }
  return i;
};

let timestamp = function() {
  return Timer.fmt(timeFormat, Timer.now());
};

let getInfo = function() {
  return JSON.stringify({
    total_ram: Sys.total_ram(),
    free_ram: Sys.free_ram()
  });
};

GPIO.set_mode(doorPin, GPIO.MODE_INPUT);
/*
{
  "data": {
    "loop": 1,
    "sensor": "legopi",
    "temperature": {
      "celcius": 0.125,
      "fahrenheit": 32.225
    },
    "timestamp": "2017-12-01T23:31:27.104806"
  },
  "device_id": "legopi",
  "timestamp": "2017-12-01T23:31:27.104806"
}
*/
//Timer.set(60000 /* 1 min */, true /* repeat */, function() {
Timer.set(1000 /* 1 min */, true /* repeat */, function() {
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
      print('Sensor#', i, 'Temperature:', t, '*C');
      let f_t = t * 9 / 5 + 32;
      let message = JSON.stringify({
        data: {
          sensor: i,
          temperature: {
            fahrenheit: f_t,
            celcius: t,
            timestamp: timestamp()
          }
        }
      });
      let ok = MQTT.pub(topic, message, 1);
      print('Published:', ok, topic, '->', message)
    }
  }

  // humidity
  let enableAnalog = ADC.enable(humidPin);
  print(enableAnalog);
  let relativeHumidity = ADC.read(humidPin);
  print(relativeHumidity);
  let av = 0.0048875*relativeHumidity;
  print(av);
  let res = (av - 0.86) / 0.03;
  print(res);

}, null);


Timer.set(1000 /* 1 sec */, true /* repeat */, function() {
  // door stuff
  let doorStatus = GPIO.read(doorPin);
  let message = JSON.stringify({
    data: {
      doorStatus: doorStatus,
      pin: doorPin,
      timestamp: timestamp()
    }
  });
  let ok = MQTT.pub(topic, message, 1);
  print('Published:', ok, topic, '->', message)
}, null);

// Monitor network connectivity.
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
