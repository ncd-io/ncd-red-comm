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
	scan(...a){
		return new Promise((fulfill, reject) => {
			this.wire.scan(...a, (err, devices) => {
				if(err) reject(err);
				else fulfill(devices);
			});
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
		var wire = this.wire;
		return this.queue.add(() => {
			return new Promise((fulfill, reject) => {
				function doRead(){
					wire.i2cRead(addr, 1, Buffer.alloc(1), (err, read, ret) => {
						if(err) reject(err);
						else fulfill(ret[0]);
					});
				}
				if(typeof reg != 'undefined'){
					wire.i2cWrite(addr, 1, Buffer.from([reg]), (err) => {
						if(err) reject(err);
						else doRead();
					});
				}else{
					doRead();
				}
			});
		});
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
};
