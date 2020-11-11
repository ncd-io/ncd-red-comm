"use strict";
//process.on('unhandledRejection', r => console.log(r));

const exec = require('child_process').exec;
const sp = require('serialport');
const comms = require("./index.js");

module.exports = function(RED) {
	var i2cPool = {};
    function NcdI2CConfig(n) {
        RED.nodes.createNode(this,n);
        this.bus = n.bus;
		this.addr = parseInt(n.addr);
		switch(n.commType){
			case 'standard':
				var port = this.bus == '_manual' ? parseInt(n.busManual) : parseInt(this.bus);
				if(typeof i2cPool[port] == 'undefined') i2cPool[port] = new comms.NcdI2C(port);
				this.i2c = i2cPool[port];
				break;
			case 'ncd-usb':
				var comm = new comms.NcdSerial(this.bus, 115200);
				if(typeof i2cPool[this.bus+'-'+this.addr] == 'undefined') i2cPool[this.bus+'-'+this.addr] = new comms.NcdSerialI2C(comm, this.addr);
				this.i2c = i2cPool[this.bus+'-'+this.addr];
				break;
		}
		if(n.useMux){
			this.i2c = new comms.NcdMux(parseInt(n.muxAddr), parseInt(n.muxPort), this.i2c);
		}
    }
    RED.nodes.registerType("ncd-comm", NcdI2CConfig);
	RED.httpAdmin.get("/ncd/i2c-bus/list/standard", RED.auth.needsPermission('serial.read'), function(req,res) {
		var busses = [];
		if(comms.hasI2C){
			comms.I2CBusScan().then(res.json.bind(res)).catch(err => {
				console.log(err);
				res.json('Unable to find any I2C Busses.');
			});
		}else{
			res.json('I2C Not Supported');
		}
	});
	RED.httpAdmin.get("/ncd/i2c-bus/scan", RED.auth.needsPermission('serial.read'), function(req,res) {
		var comm = RED.nodes.getNode(req.query.comm).i2c;
		if(typeof comm.scan != 'undefined'){
			comm.scan().then(res.json.bind(res)).catch((err) => {
				console.error(err);
				res.json([]);
			});
		}else{
			res.json([]);
		}
	});
	RED.httpAdmin.get("/ncd/i2c-bus/list/ncd-usb", RED.auth.needsPermission('serial.read'), function(req,res) {
		getSerialDevices(false, res);
	});
};

function getSerialDevices(ftdi, res){
	var busses = [];
	sp.list().then((ports) => {
		ports.forEach((p) => {
			busses.push(p.comName);
		});
	}).catch((err) => {

	}).then(() => {
		res.json(busses);
	});
}
