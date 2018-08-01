const crypto = require('crypto');

module.exports = class NcdAes{
	constructor(key){
		this.key = key;
	}
	encrypt(d){
		console.log(d);
		if(d.length % 16){
			var pad = new Buffer.alloc(16 - (d.length % 16));
			d = Buffer.concat([d, pad]);
		}
		console.log(d);
		//d = Buffer.from([0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51, 0x51]);
		this.iv = crypto.randomBytes(16);
		let cipher = crypto.createCipheriv('aes-256-cbc', this.key, this.iv);
		//let cipher = crypto.createCipher('aes128', this.key);
		let encryptedData = cipher.update(d, 'utf8', 'hex') + cipher.final('hex');
		console.log(this.iv);
		console.log(encryptedData);
		//this.decrypt(encryptedData);
		return encryptedData;
	}
	decrypt(d){
		//let iv = null;
		let decipher = crypto.createDecipheriv('aes-256-cbc', this.key, this.iv);
		var decryptedData = decipher.update(d, 'hex') + decipher.final('hex');
		console.log(decryptedData);
		return decryptedData;
	}
}
