const events = require("events");
const Queue = require("promise-queue");
module.exports = class NcdSerialI2C{
	constructor(serial, bus){
		this.comm = serial;
		this.bus = bus+50;
		this.returnTo = false;
		this.buff = [];
		this.queue = new Queue(1);
		this.queueCBs = {fulfill: false, reject: false};
		this.tout = false;
		this.version = false;
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
					clearTimeout(wire.tout);
					fulfill(payload);
				}else if(valid !== false){
					wire.buff = [];
					var reject = wire.queueCBs.reject;
					wire.queueCBs = {fulfill: false, reject: false};
					clearTimeout(wire.tout);
					reject({'I2C Error': valid});
				}else{
					//console.log('processing buffer');
				}
			}else{
				//console.log('no callback');
			}
		});
		this.comm.on('error', (err) => {
			var reject = wire.queueCBs.reject;
			wire.queueCBs = {fulfill: false, reject: false};
			reject({'I2C Error': err});
		});
		console.log(Buffer.from(this.wrapApi([254, 52, 240, 5])));
		var version_finished;

		var that = this;
		var proxy_queue = new Queue(1);
		proxy_queue.add(() => {
			return new Promise((fulfill, reject) => {
				version_finished = fulfill;
			});
		});
		this.send_raw([254, 52, 240, 5]).then((r) => {
			this.version = r[5];
			console.log('Version Set:', this.version);
			version_finished();
		}).catch((err) => {
			this.version = 1;
			console.log('failed to fetch version');
			version_finished();
			//console.log(err);
		});
		return new Proxy(this, {
			get(t, p){
				if(that.version && proxy_queue.getQueueLength() == 0 && proxy_queue.getPendingLength() == 0) return t[p];
				if(['readByte', 'readBytes', 'writeByte', 'writeBytes'].indexOf(p) > -1){
					return function(...args){
						return new Promise((fulfill, reject) => {
							proxy_queue.add(function(){
								return new Promise((f2, r2) => {
									t[p](...args).then((r) => {
										fulfill(r);
										f2(r);
									}).catch((e) => {
										reject(e);
										f2();
									});
								});
							});
						});
					};
				}else{
					return t[p];
				}
			}
		});

	}
	readBytes(addr, reg, length){
		//return this.send([addr*2+1, reg, length]);
		if(this.version == 3){
			if(length){
				//console.log('v3 - read bytes', [[190, addr, reg], [191, addr, length]]);
				return this.send([190, addr, reg], [191, addr, length]);
			}
			//console.log('v3 - read bytes', [191, addr, length]);
			return this.send([191, addr, length]);
		}else{
			if(length){
				var write = [addr*2, reg];
				if(this.version == 1) write.push(0);
				return this.send(write, [addr*2+1, length]);
			}else{
				return this.send([addr*2+1, reg]);
			}
		}
	}
	readByte(addr, reg){
		return this.readBytes(addr, reg, 1);
	}
	writeByte(addr, byte){
		if(this.version == 3){
			//console.log('v3 - write byte', [190, addr, byte]);
			return this.send([190, addr, byte]);
		}else{
			return this.send([190, addr*2, byte, 0]);
		}
	}
	writeBytes(addr, reg, ...bytes){
		if(bytes.constructor != Array) bytes = [bytes];
		if(this.version == 3){
			var payload = [190, addr, reg];
			payload.push.apply(payload, bytes);
			//console.log('v3 - write bytes', payload);
			return this.send(payload);
		}else{
			var payload = [addr*2, reg];
			payload.push.apply(payload, bytes);
			if(this.version == 1) payload.push(0);
			return this.send(payload);
		}
	}
	wrapApi(payload){
		var packet = [170, payload.length];
		packet.push.apply(packet, payload);
		packet.push(packet.reduce((t,i) => t+i)&255);
		return Buffer.from(packet);
	}
	buildPacket(payload){
		if(this.version == 1){
			var packet = [188, this.bus, payload.length-1];
			packet.push.apply(packet, payload);
		}else if(this.version == 2){
			if(payload[0] % 2){
				var packet = [191, (payload[0]-1)/2, payload[1]];
			}else{
				var packet = [190, payload.shift()/2];
				packet.push.apply(packet, payload);
			}
		}else{
			//console.log('v3', payload);
			packet = payload;
		}
		return this.wrapApi(packet);
	}
	validate(){
		if(this.buff.length){
			var len = this.buff.length;
			if(this.buff[0] == 170){
				if(len > 3 && this.buff[1]+3 == len){
					var valid = this.buff[len-1] == ((this.buff.reduce((t,i) => t+i) - this.buff[len-1]) & 255);
					if(!valid){
						return this.buff;
					}
					if(this.buff[2] == 188){
						switch(this.buff[3]){
							case 90:
							case 94:
								return "Acknowledgement not received from I2C device";
							case 91:
								return "Device took too long to respond";
							case 92:
								return "Could not set address of device";
							default:
								return "Unknown error";
						}
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
			ps = [];

		payloads.forEach((payload) => {
			ps.push(this.queue.add(() => {
				return new Promise((fulfill, reject) => {
					wire.queueCBs.reject = reject;
					wire.queueCBs.fulfill = fulfill;
					var bytesToWrite = this.buildPacket(payload);
					wire.tout = setTimeout(() => {
						wire.buff = [];
						wire.queueCBs = {fulfill: false, reject: false};
						reject({'Communication Error': 'Timeout', originalPacket: [...bytesToWrite]});
					}, 1500);

					console.log('sending v'+this.version, [...bytesToWrite]);
					wire.comm.write(bytesToWrite, (err) => {
						if(err){
							wire.buff = [];
							wire.queueCBs = {fulfill: false, reject: false};
							console.log('Error sending:', bytesToWrite);
							reject(err);
						}
					});
				});
			}));
		});
		return new Promise((fulfill, reject) => {
			Promise.all(ps).then((res) => {
				fulfill(res.pop());
			}).catch(reject);
		});
	}
	send_raw(...payloads){
		var wire = this,
			ps = [];

		payloads.forEach((payload) => {
			ps.push(this.queue.add(() => {
				return new Promise((fulfill, reject) => {
					wire.queueCBs.reject = reject;
					wire.queueCBs.fulfill = fulfill;
					wire.tout = setTimeout(() => {
						wire.buff = [];
						wire.queueCBs = {fulfill: false, reject: false};
						reject({'Communication Error': 'Timeout'});
					}, 1500);
					wire.comm.write(this.wrapApi(payload), (err) => {
						if(err){
							wire.buff = [];
							wire.queueCBs = {fulfill: false, reject: false};
							reject(err);
						}
					});
				});
			}));
		});
		return new Promise((fulfill, reject) => {
			Promise.all(ps).then((res) => {
				fulfill(res.pop());
			}).catch(reject);
		});
	}
};
