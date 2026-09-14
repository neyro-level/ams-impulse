import { spawn } from "node:child_process";

const mode = process.argv[2] ?? "web";
const args = process.argv.slice(3);

function run(argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argv, { cwd: process.cwd(), stdio: "inherit", env: process.env });
    const forward = (signal) => { if (!child.killed) child.kill(signal); };
    const stopTerm = () => forward("SIGTERM");
    const stopInt = () => forward("SIGINT");
    const cleanup = () => { process.off("SIGTERM", stopTerm); process.off("SIGINT", stopInt); };
    process.once("SIGTERM", stopTerm);
    process.once("SIGINT", stopInt);
    child.on("error", (error) => { cleanup(); reject(error); });
    child.on("exit", (code, signal) => {
      cleanup();
      if (signal) reject(new Error(`runtime exited by signal ${signal}`));
      else if (code !== 0) reject(new Error(`runtime exited with code ${code}`));
      else resolve();
    });
  });
}

const workerMain = "dist-collector/src/worker/main.js";
const authAdminMain = "dist-collector/scripts/auth-admin.js";
switch (mode) {
  case "web": await run(["server.js"]); break;
  case "outbox-worker": await run([workerMain, "outbox-daemon", process.env.OUTBOX_WORKER_ID ?? "seo-monitor-outbox"]); break;
  case "research-worker": await run([workerMain, "research-daemon"]); break;
  case "outbox-drain": await run([workerMain, "outbox-drain", args[0] ?? process.env.OUTBOX_WORKER_ID ?? "seo-monitor-outbox"]); break;
  case "outbox-retention": await run([workerMain, "outbox-retention"]); break;
  case "projects-sync": await run([workerMain, "projects-sync", args[0] ?? "daily"]); break;
  case "topvisor-checks": await run([workerMain, "topvisor-checks"]); break;
  case "competitors-sync": await run([workerMain, "competitors-sync"]); break;
  case "auth-admin": await run([authAdminMain, ...args]); break;
  case "project-sync": {
    if (!args[0]) throw new Error("Usage: runtime-entrypoint project-sync <project-slug> [trigger]");
    await run([workerMain, "project-sync", args[0], args[1] ?? "manual"]);
    break;
  }
  default: throw new Error(`Unsupported runtime mode: ${mode}`);
}
