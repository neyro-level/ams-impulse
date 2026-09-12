import { spawn } from "node:child_process";

function run(argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argv, { cwd: process.cwd(), stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`migrator exited by signal ${signal}`));
      else if (code !== 0) reject(new Error(`migrator exited with code ${code}`));
      else resolve();
    });
  });
}

if ((process.argv[2] ?? "migrate") !== "migrate") throw new Error("Unsupported migrator mode");
await run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
await run(["scripts/pgboss-migrate.mjs"]);
