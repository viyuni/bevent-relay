import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/index.ts', 'src/events.ts'],
    dts: {
      tsgo: true,
    },
    exports: true,
  },
  staged: {
    '*': 'vp check --fix',
  },
  fmt: {
    ignorePatterns: [],
    singleQuote: true,
    experimentalSortImports: {},
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      'typescript/no-useless-default-assignment': 'off',
    },
  },
  run: {
    cache: true,
  },
});
