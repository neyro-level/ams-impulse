declare const input: string;
declare const cp: {
  spawn(command: string, args: string[], options: { shell: boolean }): unknown;
  spawnSync(command: string, args: string[], options: { shell: boolean }): unknown;
};
declare const db: {
  $queryRawUnsafe(query: string): unknown;
  $executeRawUnsafe(query: string): unknown;
};
declare function exec(command: string): unknown;
declare function execSync(command: string): unknown;

eval(input);
new Function(input);
cp.spawn(input, [], { shell: true });
cp.spawnSync(input, [], { shell: true });
exec(input);
execSync(input);
db.$queryRawUnsafe(input);
db.$executeRawUnsafe(input);
const unsafeTls = { rejectUnauthorized: false };
fetch(process.env.PROVIDER_URL, {});
const apiKey = "fixture-hardcoded-credential";

void unsafeTls;
void apiKey;
