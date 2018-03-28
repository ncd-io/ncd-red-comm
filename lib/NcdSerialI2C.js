const events = require("events");
const sp = require('serialport');
const Queue = require("promise-queue");
module.exports = class NcdSerialI2C{
	constructor(serial, bus){
		this.comm = serial;
		this.bus = bus+50;
		this.returnTo = false;
		this.buff = [];
		this.queue = new Queue(1);
		this.queueCBs = {fulfill: false, reject: false};
		var wire = this;
		this.comm.on('data', function(d){
			if(wire.queueCBs.fulfill){
				wire.buff.push(d);
				var valid = wire.validate();
				if(valid === true){
					var fulfill = wire.queueCBs.fulfill;
					wire.queueCBs = {fulfill: false, reject: false};
					var payload = wire.buff.slice(2, -1);
					wire.buff = [];
					//console.log(payload);
					fulfill(payload);
				}else if(valid !== false){
					//console.log([valid]);
					wire.buff = [];
					var reject = wire.queueCBs.reject;
					wire.queueCBs = {fulfill: false, reject: false};
					reject({'I2C Error': valid});
				}else{
					//console.log('processing buffer');
				}
			}else{
				console.log('no callback');
			}
		});
	}
	readBytes(addr, reg, length){
		//return this.send([addr*2+1, reg, length]);
		return this.send([addr*2, reg, 0], [addr*2+1, length]);
	}
	readByte(addr, reg){
		return this.readBytes(addr, reg, 1);
	}
	writeByte(addr, byte){
		return this.send([addr*2, byte, 0]);
	}
	writeBytes(addr, reg, ...bytes){
		if(bytes.constructor != Array){
			return this.send([addr*2, reg, bytes, 0]);
		}else{
			var payload = [addr*2, reg];
			payload.push.apply(payload, bytes);
			payload.push(0);
			return this.send(payload);
		}
	}
	buildPacket(payload){
		var packet = [170, payload.length+3, 188, this.bus, payload.length-1];
		packet.push.apply(packet, payload);
		packet.push(packet.reduce((t,i) => t+i)&255);
		return Buffer.from(packet);
	}
	validate(){
		if(this.buff.length){
			var len = this.buff.length;
			if(this.buff[0] == 170){
				if(len > 3 && this.buff[1]+3 == len){
					var valid = this.buff[len-1] == ((this.buff.reduce((t,i) => t+i) - this.buff[len-1]) & 255);
					if(!valid){
						return this.buff;
					}else if(this.buff[2] == 188){
						return {'i2c error': this.buff};
					}
					return true;
				}
			}else{
				return 'bad header';
			}
		}
		return false;
	}
	send(...payloads){
		var wire = this,
			p;
		payloads.forEach((payload) => {
			p = this.queue.add(() => {
				return new Promise((fulfill, reject) => {
					wire.comm.write(this.buildPacket(payload), (err) => {
						if(err) reject(err);
						else{
							wire.queueCBs.reject = reject;
							wire.queueCBs.fulfill = fulfill;
						}
					});
				});
			});
		});
		return p;
	}
};