declare const input: string;
declare const cp: {
  spawn(command: string, args: string[], options: { shell: boolean }): unknown;
};

JSON.parse(input);
cp.spawn("node", [], { shell: false });
const safeTls = { rejectUnauthorized: true };
fetch("https://example.invalid/health");
const apiKeyExample = "placeholder-not-for-production";

void safeTls;
void apiKeyExample;
