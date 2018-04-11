const fs = require('fs');
var started = false;

function start(global, file){
	if(typeof global.get('ncd-persist') == 'undefined'){
		try{
			fs.accessSync(file, fs.F_OK);
			var data = fs.readFileSync(file, 'utf8');
			var parsed = JSON.parse(data);
			global.set("ncd-persist", parsed);
		}catch(e){
			var opts = {};
			global.set("ncd-persist", opts);
			fs.writeFileSync(file, JSON.stringify(opts));
		}
	}
	started = true;
}

class NcdSettings{
	constructor(o,global,def,file){
		if(typeof file == 'undefined') file = "./ncd-persist.json";
		if(typeof def == 'undefined') def = {};
		if(!started){
			start(global, file);
		}
		this.global = global;
		this.o = o;
		this.file = file;
		var persist = global.get('ncd-persist');
		if(typeof persist[o.id] == 'undefined') persist[o.id] = def;
		this.props = persist[o.id];
	}
	update(){
		var persist = this.global.get('ncd-persist');
		persist[this.o.id] = this.props;
		this.global.set("ncd-persist", persist);
		fs.writeFile(this.file, JSON.stringify(persist), function(err) {
			if(err) return console.log(err);
		});
	}
}

const NcdHandler = {
	get(target, prop){
		return target.props[prop];
	},
	set(target, prop, value){
		var update = target.props[prop] != value;
		var res = target.props[prop] = value;
		if(update) target.update();
		return true;
	},
	has(target, prop){
		return (prop in target.props);
	},
	deleteProperty(target, prop){
		delete target.props[prop];
		target.update();
	}
}

module.exports = function (...args){
	return new Proxy(new NcdSettings(...args), NcdHandler);
}
