const path = require('path');
const fs = require('fs');

function resolveDataBase() {
	// When bundled, data is copied to dist/data next to the bundle
	const distCandidate = path.join(__dirname, '..', 'dist', 'data');
	if (fs.existsSync(distCandidate)) return distCandidate;
	// Dev mode: JSON lives in handlers/
	const devCandidate = path.join(__dirname, '..', 'handlers');
	if (fs.existsSync(devCandidate)) return devCandidate;
	// Fallback: cwd based
	const cwdDist = path.join(process.cwd(), 'dist', 'data');
	if (fs.existsSync(cwdDist)) return cwdDist;
	return process.cwd();
}

function dataPath(name) {
	return path.join(resolveDataBase(), name);
}

module.exports = { dataPath };