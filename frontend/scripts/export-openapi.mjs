import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");

const result = spawnSync(
  "python",
  [
    "backend/manage.py",
    "spectacular",
    "--format",
    "openapi-json",
    "--file",
    "frontend/openapi.json",
  ],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      PYTHONPATH: "backend",
      DJANGO_SETTINGS_MODULE: "config.settings",
      DJANGO_DEBUG: "1",
    },
    stdio: "inherit",
  }
);

process.exit(result.status ?? 1);
