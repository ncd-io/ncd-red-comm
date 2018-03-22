"use strict";
process.on('unhandledRejection', r => console.log(r));

const execSync = require('child_process').execSync;
const sp = require('serialport');
const comms = require("./index.js");

module.exports = function(RED) {
	var i2cPool = {};
    function NcdI2CConfig(n) {
        RED.nodes.createNode(this,n);
        this.bus = n.bus;
		if(this.bus.indexOf('i2c-') == 0){
			var port = parseInt(this.bus.split('-')[1]);
			if(typeof i2cPool[port] == 'undefined') i2cPool[port] = new comms.NcdI2C(port);
			this.i2c = i2cPool[port];
		}else if(typeof i2cPool[this.bus] == 'undefined'){
			var comm = new comms.NcdSerial(this.bus, 115200);
			i2cPool[this.bus] = new comms.NcdSerialI2C(comm, 0);
			this.i2c = i2cPool[this.bus];
		}else{
			this.i2c = i2cPool[this.bus];
		}
    }
    RED.nodes.registerType("ncd-comm", NcdI2CConfig);
	RED.httpAdmin.get("/ncd/i2c-bus/list", RED.auth.needsPermission('serial.read'), function(req,res) {
		var busses = [];
		if(comms.hasI2C){
			var cmd = execSync('i2cdetect -l');
			cmd.toString().split("\n").forEach((ln) => {
				var bus = ln.toString().split('	')[0];
				if(bus.indexOf('i2c') == 0){
					busses.push(bus);
				}
			});
		}
		sp.list().then((ports) => {
			ports.forEach((p) => {
				//if(p.manufacturer == 'FTDI') busses.push(p.comName);
				busses.push(p.comName);
			});
		}).catch((err) => {

		}).then(() => {
			res.json(busses);
		});

	});
}
