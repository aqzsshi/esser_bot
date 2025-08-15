
		const path = require('path');
		const base = path.join(__dirname, 'data');
		module.exports.dataPath = (name) => path.join(base, name);
	