const crypto = require('crypto');
const events = require("events");

module.exports = class NcdAes{
	constructor(comm, key, opts){
		this.opts = opts || {};
		this.key = key;
		this.iv = false;
		this.ivSent = false;
		this.type = 'aes-'+(key.length*8)+'-cfb';
		this.comm = comm;
		this._emitter = new events.EventEmitter();
		this.buff = [];
		var obj = this;

		this.comm.on('data', (d) => {
			obj.buff.push(d);
		});
		this.comm.on('ready', (d) => {
			obj._emitter.emit('ready', d);
		});
		this.comm.on('closed', (d) => {
			obj._emitter.emit('closed', d);
		});
	}
	getIV(newIV){
		if(!this.iv){
			this.iv = crypto.randomBytes(16);
		}
		return this.iv;
	}
	encrypt(d){
		let iv = this.getIV(true);
		let cipher = crypto.createCipheriv(this.type, this.key, iv);
		let encryptedData = cipher.update(d, 'utf8', 'hex') + cipher.final('hex');
		encryptedData = iv.toString('hex')+encryptedData;
		this.ivSent = true;
		var ret = Buffer.from(encryptedData, 'hex');
		return ret;
	}
	decrypt(d){
		let iv = this.getIV();
		let decipher = crypto.createDecipheriv(this.type, this.key, iv);
		var decryptedData = decipher.update(d, 'hex', 'hex') + decipher.final('hex');
		decryptedData = Buffer.from(decryptedData, 'hex');
		return decryptedData;
	}
	close(cb){
		this.comm.close(cb);
	}
	write(m, cb){
		m = this.encrypt(m);
		var obj = this;
		var send = function(m, cb){
			obj.buff = [];
			setTimeout(() => {
				if(obj.buff.length){
					obj.buff = obj.decrypt(Buffer.from(obj.buff));
					for (var z=0; z<obj.buff.length; z++) obj._emitter.emit('data',obj.buff[z]);
				}
				obj.close();
			}, 500);
			obj.comm.write(m, cb);
		}
		if(!this.comm._available){
			var tout = setTimeout(() => {
				obj.comm.reconnect();
			}, 500);
			this.comm._emitter.once('ready', () => {
				clearTimeout(tout);
				send(m, cb);
			})
			this.comm.reconnect();
		}else{
			send(m, cb);
		}
	}
	on(e, cb){
		this._emitter.on(e,cb);
	}
}
