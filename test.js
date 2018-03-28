const comms = require('./index.js');
const ftdi = require('ftdi');

function makePromise(f, t){
	var func = t[f];
	var newf = function(...args){
		return new Promise((fulfill, reject) => {
			args.push((...res) => {
				var err = res.shift();
				if(err) reject(err);
				else fulfill.apply(this, res);
			});
			func(...args);
		});
	}
	t[f] = newf;
}

makePromise('find', ftdi);

ftdi.find().then((devices) => {
	var device = new ftdi.FtdiDevice({locationId: devices[0].locationId});

	device.on('error', console.log);
	device.open({
		baudrate: 115200,
		bitmode: 0x00
	}, (err) => {
		var devComm = new comms.Ft232hI2C(device);
		//console.log(device.FTDIDevice);
		device.FTDIDevice.SetDeviceSettings();
	});
}).catch(console.log);
