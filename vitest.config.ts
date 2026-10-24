import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // .claude guarda copias del repo (worktrees): no son de este checkout.
  test: { environment: "node", exclude: [...configDefaults.exclude, ".claude/**"] }
});
