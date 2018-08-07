const crypto = require('crypto');

module.exports = class NcdAes{
	constructor(key){
		this.key = key;
		this.iv = false;
		this.ivSent = false;
		this.type = 'aes-'+(key.length*8)+'-cfb';
	}
	getIV(newIV){
		if(!this.iv){
			this.iv = crypto.randomBytes(16);
		}
		return this.iv;
	}
	encrypt(d){
		let iv = this.getIV(true);
		let cipher = crypto.createCipheriv(this.type, this.key, iv);
		let encryptedData = cipher.update(d, 'utf8', 'hex') + cipher.final('hex');
		encryptedData = iv.toString('hex')+encryptedData;
		this.ivSent = true;
		var ret = Buffer.from(encryptedData, 'hex');
		return ret;
	}
	decrypt(d){
		let iv = this.getIV();
		let decipher = crypto.createDecipheriv(this.type, this.key, iv);
		var decryptedData = decipher.update(d, 'hex', 'hex') + decipher.final('hex');
		decryptedData = Buffer.from(decryptedData, 'hex');
		return decryptedData;
	}
}
