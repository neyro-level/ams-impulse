const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];
const EXACT_SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export function findDependencyVersionRanges(packageJson) {
  return DEPENDENCY_SECTIONS.flatMap((section) =>
    Object.entries(packageJson[section] ?? {})
      .filter(([, version]) => typeof version !== "string" || !EXACT_SEMVER.test(version))
      .map(([name, version]) => `${section}.${name}=${String(version)}`),
  );
}
