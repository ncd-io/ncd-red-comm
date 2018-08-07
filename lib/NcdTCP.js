const events = require("events");
const net = require("net");

module.exports = class NcdTCP{
	constructor(host, port, crypto){
		this.port = port;
		this.host = host;
		this.crypto = typeof crypto == 'undefined' ? false : crypto;
		this._available = false;
		this._closing = false;
		this._opening = true;
		this._emitter = new events.EventEmitter();
		this.tout = false;
		this.tcpReconnectTime = 100;
		this.setupClient();
	}
	setCrypto(crypto){
		this.crypto = crypto;
	}
	reconnect(){
		var obj = this;
		if (!obj._closing) {
			this._opening = true;
			obj._closing = true;
			obj._available = false;
			obj.tout = setTimeout(function() {
				obj.setupClient();
			}, obj.tcpReconnectTime);
		}
	}
	setupClient(){
		var obj = this;
		obj._closing = false;
		obj._opening = true;
		this.client = new net.Socket();
		this.client.setNoDelay();
		this.client.on('connect', () => {
			obj._closing = false;
			obj._available = true;
			this._opening = false;
			if(obj.tout) clearTimeout(obj.tout);
			obj._emitter.emit('ready');
		});

		this.client.on('error', (err) => {
			console.log(err);
		});

		this.client.on('close', () => {
			if(!obj._closing){
				obj.reconnect();
			}else{
				obj._closing = false;
				obj._available = false;
				this._opening = false;
			}
		});
		this.buff = [];
		this.client.on('data',function(d) {
			for (var z=0; z<d.length; z++) obj.buff.push(d[z]);
		});

		this.client.connect(this.port, this.host);
	}
	on(a,b){ this._emitter.on(a,b); }
	close(cb){
		this._available = false;
		this._closing = true;
		this.client.destroy();
	}
	write(m,cb){
		if(this.crypto){
			m = this.crypto.encrypt(m);
		}
		var obj = this;
		var send = function(m, cb){
			obj.buff = [];
			setTimeout(() => {
				if(obj.buff.length){
					if(obj.crypto) obj.buff = obj.crypto.decrypt(Buffer.from(obj.buff));
					for (var z=0; z<obj.buff.length; z++) obj._emitter.emit('data',obj.buff[z]);
				}
				obj.close();
			}, 500);
			obj.client.write(m, cb);
		}
		if(!this._available){
			this.reconnect();
			var tout = setTimeout(() => {
				this.reconnect();
			}, 500);
			this._emitter.once('ready', () => {
				clearTimeout(tout);
				send(m, cb);
			})
		}else{
			send(m, cb);
		}
	}
}
