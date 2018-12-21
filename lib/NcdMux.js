module.exports = class NcdMux{
	constructor(addr, port, comm){
		this.addr = addr;
		this.port = port | 8;
		this.comm = comm;
	}
	ensureMux(){
		return this.comm.writeByte(this.addr, this.port);

	}

	readBytes(addr, reg, length){
		return new Promise((fulfill, reject) => {
			Promise.all([
				this.ensureMux(),
				this.comm.readBytes(addr, reg, length)
			]).then((r) => {
				fulfill(r.pop());
			}).catch((e) => {
				reject(e);
			});
		});
	}
	readByte(addr, reg){
		return new Promise((fulfill, reject) => {
			Promise.all([
				this.ensureMux(),
				this.comm.readByte(addr, reg)
			]).then((r) => {
				fulfill(r.pop());
			}).catch((e) => {
				reject(e);
			});
		});
	}
	writeByte(addr, byte){
		return new Promise((fulfill, reject) => {
			Promise.all([
				this.ensureMux(),
				this.comm.writeByte(addr, byte)
			]).then((r) => {
				fulfill(r.pop());
			}).catch((e) => {
				reject(e);
			});
		});
	}

	writeBytes(addr, reg, ...bytes){
		return new Promise((fulfill, reject) => {
			Promise.all([
				this.ensureMux(),
				this.comm.writeBytes(addr, reg, ...bytes)
			]).then((r) => {
				fulfill(r.pop());
			}).catch((e) => {
				reject(e);
			});
		});
	}
};
