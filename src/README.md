# Source Notes

These sources were restored from the bundled sourcemap and updated to document the current generic actions.

The Stream Deck plugin still runs `com.romain.livemixer.sdPlugin/bin/plugin.js`. There is no build toolchain in this folder yet, so runtime fixes made in this session were also applied directly to the bundle.

Before larger changes, add a `package.json`/`tsconfig.json` build step and make `src/plugin.ts` the source of truth.
