const events = require("events");
const sp = require('serialport');
const Queue = require("promise-queue");
module.exports = class NcdSerial{
	constructor(port, baudRate){
		this.port = port;
		this.baudRate = baudRate;
		this._emitter = new events.EventEmitter();
		this.tout = null;
		this.serialReconnectTime = 3000;
		this.setupSerial();
	}
	reconnect(){
		var obj = this;
		if (!obj._closing) {
			obj._closing = true;
			obj._available = false;
			obj._emitter.emit('closed');
			obj.tout = setTimeout(function() {
				obj.setupSerial();
			}, obj.serialReconnectTime);
		}
	}
	setupSerial(){
		var obj = this;
		obj._closing = false;
		this.serial = new sp(this.port, {
			baudRate: this.baudRate,
			autoOpen: true
		});

		this.serial.on('error', function(err) {
			obj.reconnect();
		});
		this.serial.on('close', function() {
			obj.reconnect();
		});
		this.serial.on('open',function() {
			obj._closing = false;
			obj._available = true;
			if (obj.tout) { clearTimeout(obj.tout); }
			obj._emitter.emit('ready');
		});
		this.serial.on('data',function(d) {
			for (var z=0; z<d.length; z++) {
				obj._emitter.emit('data',d[z]);
			}
		});
	}
	on(a,b){ this._emitter.on(a,b); }
	close(cb){ this.serial.close(cb); }
	write(m,cb){ this.serial.write(m, cb); }
}
