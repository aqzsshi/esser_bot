const { build } = require('esbuild');
const { promises: fs } = require('fs');
const path = require('path');

async function ensureDir(dir) {
	await fs.mkdir(dir, { recursive: true }).catch(() => {});
}

async function copyFile(src, dest) {
	await ensureDir(path.dirname(dest));
	await fs.copyFile(src, dest);
}

async function copyData() {
	const dataSrcDir = path.resolve(__dirname, '..', 'handlers');
	const dataDestDir = path.resolve(__dirname, '..', 'dist', 'data');
	await ensureDir(dataDestDir);
	// Copy serverConfigs.json and skillsData.json
	for (const name of ['serverConfigs.json', 'skillsData.json']) {
		const from = path.join(dataSrcDir, name);
		try {
			await copyFile(from, path.join(dataDestDir, name));
		} catch {}
	}
}

async function main() {
	await ensureDir(path.resolve(__dirname, '..', 'dist'));
	await build({
		platform: 'node',
		target: 'node20',
		format: 'cjs',
		bundle: true,
		entryPoints: [path.resolve(__dirname, '..', 'index.js')],
		outfile: path.resolve(__dirname, '..', 'dist', 'index.js'),
		external: [
			// Native and heavy deps better kept external at runtime
			'canvas',
			'bufferutil',
			'utf-8-validate'
		],
		loader: {
			'.png': 'file',
			'.jpg': 'file',
			'.jpeg': 'file',
			'.gif': 'file',
			'.webp': 'file',
			'.json': 'json'
		},
		define: {
			'process.env.NODE_ENV': '"production"',
			'process.env.BUNDLED': '"true"'
		},
		sourcemap: true,
		logLevel: 'info',
	});
	await copyData();
	// Create runtime shim to map data paths
	const shimPath = path.resolve(__dirname, '..', 'dist', 'path-shim.js');
	await fs.writeFile(shimPath, `
		const path = require('path');
		const base = path.join(__dirname, 'data');
		module.exports.dataPath = (name) => path.join(base, name);
	`);
	console.log('Build complete');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});