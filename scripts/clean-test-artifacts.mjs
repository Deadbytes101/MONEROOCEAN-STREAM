import { rmSync } from "node:fs";

for (const path of ["build"]) {
  rmSync(path, { recursive: true, force: true });
}
