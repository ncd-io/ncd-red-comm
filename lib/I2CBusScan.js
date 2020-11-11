const fs = require('fs');
const readline = require('readline');
const Queue = require('requeued');
const util = require('util');
const exec = require('child_process').exec;

module.exports = function busScan(){
	return (new Queue()).any([
		i2cDetectScan,
		sysfsScan
	]);
}
function sysfsScan(){
	function sysfsProbe(format, name){
		if(fs.lstatSync(util.format(format, name)).isFile()){
			var [type, bus] = name.split('-');
			return type == 'i2c' ? bus : false;
		}
		return false
	}
	return new Promise((fulfill, reject) => {
		var file = readline.createInterface({
			input: fs.createReadStream('/proc/mounts'),
			output: process.stdout,
			terminal: false
		});
		var sysfs = false;
		file.on('line', (line) => {
			if(!sysfs){
				var [,path, type] = line.split(' ');
				if(type == 'sysfs'){
					sysfs = path+'/class/i2c-dev';
					if(fs.lstatSync(sysfs).isDirectory()){
						fs.readdir(sysfs, (err, entries) => {
							if(err) reject(err);
							else{
								var busses = entries.map(name => {
									return sysfsProbe(sysfs+'/%s/name', name)
									|| sysfsProbe(sysfs+'/%s/device/name', name);
								}).filter(n => n);
								if(busses.length) fulfill(busses);
								else reject('no i2c busses found');
							}
						});
					}else{
						reject('could not find', sysfs);
					}
					file.close();
				}
			}
		});
		file.on('close', () => {
			if(!sysfs) reject('could not find sysfs');
		});
	});
}
function i2cDetectScan(){
	return new Promise((fulfill, reject) => {
		exec('i2cdetect -l', (err, stdout, stderr) => {
			if(err) reject('no i2cdetect');
			else{
				fulfill(stdout.toString().split("\n").map((ln) => {
					var bus = ln.toString().split('	')[0];
					return bus.indexOf('i2c') == 0 ? bus.split('-')[1] : false;
				}).filter(b => b));
			}
		})
	})
}
