"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient, usernameClient } from "better-auth/client/plugins";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

export const authClient = createAuthClient({
  plugins: [
    oauthProviderClient(),
    twoFactorClient(),
    usernameClient({ displayUsername: false }),
  ],
});
