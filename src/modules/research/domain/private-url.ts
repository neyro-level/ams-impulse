const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);

export function isApprovedPrivateStorageUrl(value: string, allowTestLoopbackHttp = false) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:"
    || (allowTestLoopbackHttp && url.protocol === "http:" && loopbackHosts.has(url.hostname));
}
