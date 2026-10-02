import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const base = "/pong-playoff-tree-generator/";

export default defineConfig({
  base,
  plugins: [
    react(),
    {
      name: "admin-pages-routes",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const path = new URL(request.url, "http://localhost").pathname;
          if (path === `${base}admin` || path === `${base}admin/`) {
            request.url = `${base}admin.html`;
          }
          next();
        });
      },
      async closeBundle() {
        const directory = resolve("dist", "admin");
        await mkdir(directory, { recursive: true });
        await copyFile(
          resolve("dist/admin.html"),
          resolve(directory, "index.html")
        );
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        index: resolve("index.html"),
        admin: resolve("admin.html")
      }
    }
  }
});
