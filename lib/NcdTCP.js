const events = require("events");
const net = require("net");

module.exports = class NcdTCP{
	constructor(host, port, crypto){
		this.port = port;
		this.host = host;
		this._emitter = new events.EventEmitter();
		this.crypto = typeof crypto == 'undefined' ? false : crypto;
		this.tout = null;
		this.tout2 = null;
		this.tcpReconnectTime = 60;
		this._available = false;
		this._closing = false;
	}
	setCrypto(crypto){
		this.crypto = crypto;
	}
	// checkState(){
	// 	console.log('this.client.readyState');
	// 	console.log(this.client.readyState);
	// 	var obj = this;
	// 	var now = new Date();
	// 	console.log(now.getTime());
	// 	obj.tout2 = setTimeout(function() {
	// 		obj.checkState();
	// 	}, 5000);
	// }
	reconnect(){
		var obj = this;
		if(this._available){
			this.close();
		}else{
			if(obj.tout === null){
				obj.tout = setTimeout(function() {
					obj.setupClient();
				}, 2000);
			}
		}
	}
	setupClient(){
		var obj = this;
		obj._closing = false;
		this.client = new net.Socket();
		this.client.setNoDelay();
		this.client.setKeepAlive(true, 0);
		this.client.on('error', (err) => {
			console.log(err);
		});
		this.client.on('connect', () => {
			obj._closing = false;
			obj._available = true;
			if(obj.tout) clearTimeout(obj.tout);
			obj._emitter.emit('ready');
		});
		this.client.on('timeout', function(err){
			console.log(err);
		});
		this.client.on('end', function(err){
			console.log(err);
		});
		this.client.on('data',function(d) {
			for (var z=0; z<d.length; z++) obj._emitter.emit('data',d[z]);
		});
		this.client.on('close', function(msg){
			if(msg){
				obj._available = false;
				obj._emitter.emit('closed_comms');
				obj.reconnect();

			}
		});
		this.buff = [];

		this.client.connect(this.port, this.host);
		// this.checkState();
	}
	on(a,b){ this._emitter.on(a,b); }
	close(cb){
		this._closing = true;
		if(this._available){
			this.client.destroy();
			// this.client.resetAndDestroy();
		}
		this._available = false;
	}
	write(m,cb){
		var obj = this;
		if(m.constructor == Array) m = Buffer.from(m);
		if(!this._available){
			this.reconnect();
			var tout = setTimeout(() => {
				this.reconnect();
			}, 500);
			this._emitter.once('ready', () => {
				clearTimeout(tout);
				obj.client.write(m, cb);
			});
		}else{
			obj.client.write(m, cb);
		}
	}
};
