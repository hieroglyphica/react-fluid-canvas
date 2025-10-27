import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  if (command === 'serve') {
    // Configuration for the development server
    return {
      plugins: [react()],
      server: {
        host: '0.0.0.0',
        port: 5173,
      },
    };
  } else {
    // Configuration for the library build
    return {
      plugins: [
        react(),
        dts({ insertTypesEntry: true }),
      ],
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
      },
    };
  }
});