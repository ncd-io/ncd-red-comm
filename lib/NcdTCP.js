const events = require("events");
const net = require("net");

module.exports = class NcdTCP{
	constructor(host, port, crypto){
		this.port = port;
		this.host = host;
		this.crypto = crypto;
		this._available = false;
		this._connecting = false;
		this._closing = false;
		this._emitter = new events.EventEmitter();
		this.tout = false;
		this.tcpReconnectTime = 1000;
		this.setupClient();
	}
	reconnect(){
		var obj = this;
		if (!obj._closing) {
			obj._closing = true;
			obj._available = false;
			obj._emitter.emit('closed');
			obj.tout = setTimeout(function() {
				obj.setupClient();
			}, obj.tcpReconnectTime);
		}
	}
	setupClient(){
		var obj = this;
		obj._closing = false;
		this.client = new net.Socket();

		this.client.on('connect', () => {
			console.log('connected');
			obj._closing = false;
			obj._available = true;
			if(obj.tout) clearTimeout(obj.tout);
			obj._emitter.emit('ready');
		});

		this.client.on('error', (err) => {
			console.log(err);
			obj.reconnect();
		});

		this.client.on('close', () => {
			if(!obj._closing){
				obj.reconnect();
			}else{
				obj._closing = false;
				obj._available = false;
			}
		});

		this.client.on('data',function(d) {
			if(typeof this.crypto != 'undefined'){
				d = this.crypto.decrypt(d);
			}
			console.log('Client Data:');
			console.log(d);
			for (var z=0; z<d.length; z++) {
				obj._emitter.emit('data',d[z]);
			}
		});

		this.client.connect(this.port, this.host);
	}
	on(a,b){ this._emitter.on(a,b); }
	close(cb){
		this._closing = true;
		this.client.destroy(cb);
	}
	write(m,cb){
		if(typeof this.crypto != 'undefined'){
			m = this.crypto.encrypt(m);
		}
		var obj = this;
		if(!this._available){
			this.on('ready', () => {
				obj.client.write(m, cb);
			})
		}else{
			obj.client.write(m, cb);
		}
	}
}
