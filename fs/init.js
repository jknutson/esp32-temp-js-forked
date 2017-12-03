load('api_config.js');
load('api_gpio.js');
load('api_mqtt.js');
load('api_net.js');
load('api_sys.js');
load('api_timer.js');
load('api_arduino_onewire.js');
load('ds18b20.js');

let oneWirePin = 14;
let led = Cfg.get('pins.led');
let button = Cfg.get('pins.button');
let topic = '/devices/' + Cfg.get('device.id') + '/events';

print('LED GPIO:', led, 'button GPIO:', button);

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


let getInfo = function() {
  return JSON.stringify({
    total_ram: Sys.total_ram(),
    free_ram: Sys.free_ram()
  });
};

// Blink built-in LED every second
GPIO.set_mode(led, GPIO.MODE_OUTPUT);
Timer.set(1000 /* 1 sec */, true /* repeat */, function() {
  let value = GPIO.toggle(led);
  print(value ? 'Tick' : 'Tock', 'uptime:', Sys.uptime(), getInfo());
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
        fahrenheit: f_t,
        celcius: t
      });
      let ok = MQTT.pub(topic, message, 1);
      print('Published:', ok, topic, '->', message)
    }
  }

}, null);

// Publish to MQTT topic on a button press. Button is wired to GPIO pin 0
GPIO.set_button_handler(button, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 200, function() {
  let message = getInfo();
  let ok = MQTT.pub(topic, message, 1);
  print('Published:', ok, topic, '->', message);
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
