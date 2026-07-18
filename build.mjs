import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

/**
 * SillyTavern core modules are provided by the host at runtime and imported via
 * relative paths (e.g. ../../../world-info.js, resolved against the installed
 * extension's URL). Mark them external so esbuild leaves the import in place
 * instead of trying to resolve/bundle a file that isn't in this repo.
 */
const stExternals = {
  name: 'st-externals',
  setup(build) {
    build.onResolve({ filter: /\/(world-info|script|slash-commands|extensions)\.js$/ }, (args) => ({
      path: args.path,
      external: true,
    }));
  },
};

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  outfile: 'index.js',
  sourcemap: true,
  logLevel: 'info',
  plugins: [stExternals],
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('[worldbook-sync] watching for changes…');
} else {
  await esbuild.build(options);
}
