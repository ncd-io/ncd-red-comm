const events = require("events");
const sp = require('serialport');

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
			// This detects if the digi module is unavailable for some time
			if(obj._available){
				obj._closing = true;
				obj._available = false;
				obj._emitter.emit('closed');
				obj.tout = setTimeout(function() {
					obj.setupSerial(false, true);
				}, obj.serialReconnectTime);
			}
			obj._closing = true;
			obj._available = false;
			obj._emitter.emit('closed');
			obj.tout = setTimeout(function() {
				obj.setupSerial(true);
			}, obj.serialReconnectTime);
		}
	}
	setupSerial(is_reconnect, is_retry = false){
		var obj = this;
		obj._closing = false;
		if(is_reconnect){
			console.log('serial port is reconnecting');
			this.serial.open();
			return;
		}
		if(is_retry){
			this.close();
		}
		this.serial = new sp(this.port, {
			baudRate: this.baudRate,
			autoOpen: false
		});

		this.serial.on('error', function(err) {
			console.log(err);
			obj.reconnect();
		});
		this.serial.on('close', function() {
			if(!obj._closing){
				obj.reconnect();
			}else{
				obj._closing = false;
				obj._available = false;
			}
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
		this.serial.open(() => {
		});
	}
	on(a,b){ this._emitter.on(a,b); }
	close(cb){
		this._closing = true;
		this.serial.close(cb);
	}
	write(m,cb){
		var obj = this;
		if(!this._available){
			this.on('ready', () => {
				obj.serial.write(m, cb);
			});
		}else{
			this.serial.write(m, cb);
		}
	}
};
