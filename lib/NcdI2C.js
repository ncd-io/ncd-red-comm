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
		if(typeof length == 'undefined'){
			length = reg;
			return this.queue.add(() => {
				return new Promise((fulfill, reject) => {
					var buff = Buffer.alloc(length);
					wire.i2cRead(addr, length, buff, (err, read, ret) => {
						if(err) reject({
							func: "readBytes",
							addr: addr  ,
							length: length,
							err: err
						});
						else fulfill(ret);
					});
				});
			});
		}else{
			return this.queue.add(() => {
				return new Promise((fulfill, reject) => {
					var buff = Buffer.alloc(length);
					wire.readI2cBlock(addr, reg, length, buff, (err, read, ret) => {
						if(err) reject(err);
						else fulfill(ret);
					});
				});
			});
		}
	}
	readByte(addr, reg){
		var wire = this.wire;
		return this.queue.add(() => {
			return new Promise((fulfill, reject) => {
				wire.readByte(addr, reg, (e,b) => {
					if(e) reject(e);
					else fulfill(b);
				});
			});
		});
	}
	writeByte(addr, byte){
		var wire = this.wire;
		return this.queue.add(() => {
			return new Promise((fulfill, reject) => {
				wire.sendByte(addr, byte, (err) => {
					if(err) reject(err);
					else fulfill();
				});
			});
		});
	}

	writeBytes(addr, reg, bytes){
		var wire = this.wire;
		if(bytes.constructor != Array){
			return this.queue.add(() => {
				return new Promise((fulfill, reject) => {
					wire.writeByte(addr, reg, bytes, (err) => {
						if(err) reject(err);
						else{
							fulfill();
						}
					});
				});
			});
		}else{
			return this.queue.add(() => {
				return new Promise((fulfill, reject) => {
					var buff = Buffer.from(bytes)
					wire.writeI2cBlock(addr, reg, bytes.length, buff, (err) => {
						if(err) reject(err);
						else fulfill();
					});
				});
			});
		}
	}
}
