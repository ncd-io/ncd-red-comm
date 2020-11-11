var i2c;
try{
	i2c = require('i2c-bus');
}catch(e){
	i2c = false;
}
module.exports = {
	hasI2C: i2c !== false,
	I2CBusScan: require('./lib/I2CBusScan'),
	NcdSerial: require("./lib/NcdSerial.js"),
	NcdI2C: require("./lib/NcdI2C.js"),
	NcdTCP: require("./lib/NcdTCP.js"),
	NcdSerialI2C: require("./lib/NcdSerialI2C.js"),
	NcdSettings: require("./lib/NcdSettings.js"),
	NcdMux: require("./lib/NcdMux.js"),
	NcdAes: require("./lib/NcdAes.js"),
	NcdDigiParser: require("./lib/NcdDigiParser.js")
};
