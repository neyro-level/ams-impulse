import { createServer } from "node:http";

if (process.env.APP_ENV !== "test") {
  throw new Error("Synthetic S3 server is restricted to APP_ENV=test");
}

const host = "127.0.0.1";
const port = Number(process.env.E2E_S3_PORT ?? "3199");
const objects = new Map();

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end('{"status":"ok"}');
    return;
  }

  if (request.method === "PUT") {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      objects.set(url.pathname, Buffer.concat(chunks));
      response.writeHead(200, { etag: '"synthetic-e2e-object"' });
      response.end();
    });
    return;
  }

  if (request.method === "GET" && objects.has(url.pathname)) {
    response.writeHead(200, {
      "cache-control": "private, no-store",
      "content-disposition": 'attachment; filename="research.csv"',
      "content-type": "text/csv; charset=utf-8",
    });
    response.end(objects.get(url.pathname));
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end('{"error":"not_found"}');
});

server.listen(port, host, () => {
  process.stdout.write(`synthetic_s3=http://${host}:${port}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
