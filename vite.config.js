import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // The dts plugin must run before the react plugin to see the original code
    dts({ insertTypesEntry: true }),
    // The react plugin must be split into two parts
    react({ jsxRuntime: 'classic' }),
    { ...react(), enforce: 'post', apply: 'build' },
  ],
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, 'src/index.jsx'),
      name: 'ReactFluidCanvas',
      // the proper extensions will be added
      fileName: 'react-fluid-canvas',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: { react: 'React', 'react-dom': 'ReactDOM' },
      },
    },
  },
});