import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig(() => {
  // Build the library if the VITE_BUILD_LIBRARY environment variable is set
  if (process.env.VITE_BUILD_LIBRARY) {
    // Configuration for the library build
    return {
      plugins: [react(), dts({ insertTypesEntry: true })],
      build: {
        lib: {
          entry: resolve(fileURLToPath(new URL('.', import.meta.url)), 'src/index.jsx'),
          name: 'ReactFluidCanvas',
          fileName: 'react-fluid-canvas',
        },
        rollupOptions: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
              'react/jsx-runtime': 'jsxRuntime',
            },
            exports: 'named',
          },
        },
        // Prevent variable name mangling in GLSL shaders
        terserOptions: {
          compress: {
            ecma: 2020,
          },
        },
      },
    };
  }

  // Default configuration for the demo app (dev and preview)
  return {
    plugins: [react()],
    // Configuration for the development server
    server: {
      host: '0.0.0.0',
      port: 5173,
    },
    build: {
      // Standard app build, which will produce an index.html
    },
  };
});