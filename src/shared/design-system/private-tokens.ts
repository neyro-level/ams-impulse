import type { Viewport } from "next";

// Browser metadata cannot resolve a CSS custom property, so this is the typed
// source of truth paired with the private --background semantic token.
export const PRIVATE_APP_VIEWPORT = {
  colorScheme: "light",
  themeColor: "#edf2f6",
} satisfies Viewport;
