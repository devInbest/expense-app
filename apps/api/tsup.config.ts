import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cron.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Workspace packages ship TS source, so they are bundled; npm deps stay external.
  noExternal: [/^@expense\//],
});
