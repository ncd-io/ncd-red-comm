"use strict";

const execSync = require('child_process').execSync;
var i2c = require('i2c-bus');
var sp = require('serialport');
var events = require("events");
var Queue = require("promise-queue");

module.exports = function(RED) {
	var i2cPool = {};
    function NcdI2CConfig(n) {
        RED.nodes.createNode(this,n);
        this.bus = n.bus;
		if(this.bus.indexOf('i2c-') == 0){
			var port = parseInt(this.bus.split('-')[1]);
			if(typeof i2cPool[port] == 'undefined') i2cPool[port] = new NcdI2C(port);
			this.i2c = i2cPool[port];
		}else if(typeof i2cPool[this.bus] == 'undefined'){
			var comm = new NcdSerial(this.bus, 9600);
			i2cPool[this.bus] = new NcdSerialI2C(comm, 0);
			this.i2c = i2cPool[this.bus];
		}else{
			console.log('Invalid I2c Bus/Port: '+port);
		}
    }
    RED.nodes.registerType("ncd-comm", NcdI2CConfig);
	RED.httpAdmin.get("/ncd/i2c-bus/list", RED.auth.needsPermission('serial.read'), function(req,res) {
		var cmd = execSync('i2cdetect -l');
		var busses = [];
		cmd.toString().split("\n").forEach((ln) => {
			var bus = ln.toString().split('	')[0];
			if(bus.indexOf('i2c') == 0){
				busses.push(bus);
			}
		});

		sp.list().then((ports) => {
			ports.forEach((p) => {
				if(p.manufacturer == 'FTDI') busses.push(p.comName);
			});
		}).catch((err) => {

		}).then(() => {
			res.json(busses);
		});

	});
}
class NcdSerial{
	constructor(port, baudRate){
		this.port = port;
		this.baudRate = baudRate;
		this._emitter = new events.EventEmitter();
		this._closing = false;
		this.tout = null;
		this.setupSerial();
	}

	setupSerial(){
		var obj = this;
		this.serial = new sp(port, {
			baudRate: baudRate,
			autoOpen: true
		});
		this.serial.on('error', function(err) {
			obj._emitter.emit('closed');
			obj.tout = setTimeout(function() {
				obj.setupSerial();
			}, settings.serialReconnectTime);
		});
		this.serial.on('close', function() {
			if (!obj._closing) {
				obj._emitter.emit('closed');
				obj.tout = setTimeout(function() {
					obj.setupSerial();
				}, settings.serialReconnectTime);
			}
		});
		this.serial.on('open',function() {
			olderr = "";
			if (obj.tout) { clearTimeout(obj.tout); }
			//obj.serial.flush();
			obj._emitter.emit('ready');
		});
		this.serial.on('data',function(d) {
			for (var z=0; z<d.length; z++) {
				obj._emitter.emit('data',d[z]);
			}
		});
	}
	on(a,b){ this._emitter.on(a,b); }
	close(cb){ this.serial.close(cb); }
	write(m,cb){ this.serial.write(m, cb); }
}
class NcdSerialI2C{
	constructor(serial, bus){
		this.comm = serial;
		this.bus = bus;
		this.returnTo = false;
		this.buff = [];
		this.queue = new Queue(1);
		this.queueCBs = {fulfill: false, reject: false};
		var wire = this;
		this.comm.on('data', function(d){
			if(wire.queueCBs.fulfill){
				wire.buff.push(d);
				if(wire.validatePacket()){
					wire.queueCBs = {fulfill: false, reject: false};
					wire.queueCBs.fulfill(this.buff.slice(2, -1));
				}
			}
		});
	}
	readBytes(addr, reg, length){
		return this.send([188, this.bus, 2, addr, reg, length], length);
	}
	readByte(addr, reg){
		var wire = this;
		return new Promise((fulfill, reject) => {
			wire.send([188, wire.bus, 2, addr, reg, 1], 1).then((b) => {
				fulfill(b[0]);
			}).catch(reject);
		})
	}
	writeByte(addr, byte){
		return this.send([188, this.bus, 2, addr, byte, 0], false);
	}
	writeBytes(addr, reg, bytes){
		if(bytes.constructor != Array){
			return this.writeByte([188, this.bus, 3, addr, reg, bytes, 0], false);
		}else{
			var payload = [188, this.bus, 2+bytes.length, addr, reg];
			payload.push.apply(payload, bytes);
			payload.push(0);
			return this.send(payload);
		}
	}
	buildPacket(payload){
		var packet = [170, payload.length];
		packet.push.apply(packet, payload);
		packet.push(packet.reduce((t,i) => t+i)&255);
		return packet;
	}
	validate(){
		if(this.buff.length){
			var len = this.buff.length;
			if(this.buff[0] == 170){
				if(len > 3 && this.buff[1]+3 == len){
					valid = this.buff[len-1] == (this.buff.reduce((t,i) => t+i) & 255);
					if(!valid){
						this.queueCBs.reject({'bad buffer': this.buff});
						this.buff = [];
						this.queueCBs = {fulfill: false, reject: false};
						return false;
					}
					return true;
				}
			}else if(this.buff[0] == 88){
				this.queueCBs.reject({'error response': this.buff});
				this.buff = [];
				this.queueCBs = {fulfill: false, reject: false};
				return false;
			}else{
				this.queueCBs.reject({'bad header': this.buff});
				this.buff = [];
				this.queueCBs = {fulfill: false, reject: false};
				return false;
			}
		}
		return false;
	}
	parsePacket(packet){

	}
	send(payload, rb){
		var wire = this;
		var packet = this.buildPacket(payload);
		this.queue.add(() => {
			return new Promise((fulfill, reject) => {
				wire.queueCBs.reject = reject;
				wire.queueCBs.fulfill = fulfill;
				wire.comm.write(Buffer.from(packet), (err) => {
					if(err){
						wire.queueCBs = {fulfill: false, reject: false};
						reject(err);
					}
				});
			});
		});
	}
}
class NcdI2C{
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
						if(err) reject({
							func: "writeBytes",
							addr: addr  ,
							reg: reg,
							bytes: bytes,
							err: err
						});
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
