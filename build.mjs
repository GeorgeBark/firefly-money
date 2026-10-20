// Bundles app/src into app/assets/js: boot.js (runs in <head> before first paint) and app.js (everything else).
// npm run build, or npm run watch to rebuild on every save while dev/mock_server.py is running.
import * as esbuild from 'esbuild';

const options = {
  entryPoints: { boot: 'app/src/boot.ts', app: 'app/src/main.ts' },
  outdir: 'app/assets/js',
  bundle: true,
  minify: true,
  sourcemap: 'linked',
  format: 'iife',
  target: 'es2020',
  logLevel: 'info',
};

if (process.argv.includes('--watch')) await (await esbuild.context(options)).watch();
else await esbuild.build(options);
