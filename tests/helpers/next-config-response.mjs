import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../../next.config.ts";

export function responseFromNextConfig(pathname) {
  return unstable_getResponseFromNextConfig({
    url: `https://impulse.ams24.ru${pathname}`,
    nextConfig,
  });
}
