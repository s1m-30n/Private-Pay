import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // eslint-disable-next-line no-undef
  const env = loadEnv(mode, process.cwd());

  const serverConfig =
    env.VITE_ENABLE_LOCAL_DNS === "true"
      ? {
          host: "squidl.test",
          port: 5173,
          hmr: {
            host: "squidl.test",
            protocol: "ws",
          },
        }
      : {
          strictPort: false,
        };

  return {
    base: '/', // Explicit base path for Vercel
    plugins: [
      react(),
      svgr(),
      nodePolyfills({
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
        protocolImports: true,
      }),
    ],
    server: serverConfig,
    define: {
      "process.env": {},
      global: "globalThis",
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        // Override nested readable-stream in ripemd160/hash-base
        "readable-stream": "readable-stream",
      },
    },
    optimizeDeps: {
      include: [
        "readable-stream",
        "buffer",
      ],
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
        include: [/node_modules/],
      },
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        plugins: [],
        output: {
          manualChunks: (id) => {
            // Split large vendor libraries into separate chunks
            if (id.includes('node_modules')) {
              if (id.includes('@solana')) return 'vendor-solana';
              if (id.includes('ethers')) return 'vendor-ethers';
              if (id.includes('starknet')) return 'vendor-starknet';
              if (id.includes('@aptos')) return 'vendor-aptos';
              if (id.includes('@cosmjs') || id.includes('osmojs')) return 'vendor-cosmos';
              if (id.includes('o1js')) return 'vendor-mina';
              if (id.includes('@nextui-org')) return 'vendor-ui';
              return 'vendor';
            }
          },
        },
      },
    },
  };
});