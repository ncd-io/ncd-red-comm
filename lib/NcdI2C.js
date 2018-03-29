const Queue = require("promise-queue");
var i2c;
try{
	i2c = require('i2c-bus');
}catch(e){
	i2c = false;
}
module.exports = class NcdI2C{
	constructor(port){
		this.port = port;
		this.queue = new Queue(1);
		this.wire = i2c.open(port, (err) => {
			if(err) console.log(err);
		});
	}
	readBytes(addr, reg, length){
		var wire = this.wire;
		return this.queue.add(() => {
			return new Promise((fulfill, reject) => {
				function doRead(l){
					wire.i2cRead(addr, l, Buffer.alloc(l), (err, read, ret) => {
						if(err) reject(err);
						else fulfill(ret);
					});
				}
				if(typeof length != 'undefined'){
					wire.i2cWrite(addr, 1, Buffer.from([reg]), (err) => {
						if(err) reject(err);
						else doRead(length);
					});
				}else{
					doRead(reg);
				}
			});
		});
	}
	readByte(addr, reg){
		if(typeof reg == 'undefined') return this.readBytes(addr, 1);
		return this.readBytes(addr, reg, 1);
	}
	writeByte(addr, byte){
		var wire = this.wire;
		return this.queue.add(() => {
			return new Promise((fulfill, reject) => {
				wire.i2cWrite(addr, 1, Buffer.from([byte]), (err) => {
					if(err) reject(err);
					else fulfill();
				});
			});
		});
	}

	writeBytes(addr, reg, ...bytes){
		var wire = this.wire;
		return this.queue.add(() => {
			bytes.unshift(reg);
			return new Promise((fulfill, reject) => {
				wire.i2cWrite(addr, bytes.length, Buffer.from(bytes), (err) => {
					if(err) reject(err);
					else fulfill();
				});
			});
		});
	}
}
