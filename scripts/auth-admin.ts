import { MembershipRole, SystemRole } from "../src/generated/prisma/client.ts";
import { createPrismaContext } from "../src/platform/database/prisma/context.ts";
import { randomUUID } from "node:crypto";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  generateRandomString,
  hashPassword,
  symmetricDecrypt,
  symmetricEncrypt,
} from "better-auth/crypto";
import { createLocalAccountIssuer } from "better-auth/db";
import { createOTP } from "@better-auth/utils/otp";
import { parseSystemRole } from "../src/modules/identity-access/index.ts";
import { readAuthEnvironment } from "../src/platform/config/server-environment.ts";
import {
  createPlatformAdminRecoveryBatch,
  hashPlatformAdminRecoveryCode,
} from "../src/platform/auth/platform-admin-recovery.ts";

type AuthAdminCommand =
  | "create"
  | "disable"
  | "reset-password"
  | "set-system-role"
  | "bootstrap-platform-admin"
  | "verify-platform-admin-bootstrap"
  | "adopt-legacy-platform-admin"
  | "verify-platform-admin-adoption"
  | "recover-platform-admin"
  | "verify-platform-admin-recovery"
  | "add-to-organization"
  | "remove-from-organization";

const command = process.argv[2] as AuthAdminCommand | undefined;
const args = process.argv.slice(3);
const options: Record<string, string> = {};

for (let index = 0; index < args.length; index += 1) {
  const current = args[index];
  if (current === "--") {
    continue;
  }
  if (!current.startsWith("--")) {
    throw new Error(`Unexpected argument: ${current}`);
  }
  const key = current.slice(2);
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for --${key}`);
  }
  options[key] = value;
  index += 1;
}

const database = createPrismaContext({
  APP_ENV: process.env.APP_ENV,
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_HOST: process.env.DATABASE_HOST,
  DATABASE_PORT: process.env.DATABASE_PORT,
  DATABASE_USER: process.env.DATABASE_USER,
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
  DATABASE_NAME: process.env.DATABASE_NAME,
  DATABASE_SSLMODE: process.env.DATABASE_SSLMODE,
});
const { prisma } = database;

function requireOption(name: string) {
  const value = options[name];
  if (!value) {
    throw new Error(`Missing required option --${name}`);
  }
  return value;
}

function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    throw new Error("Username must contain 3-30 lowercase Latin letters, digits, or underscores");
  }
  return username;
}

function requireUsername() {
  return normalizeUsername(requireOption("username"));
}

function readPasswordFromStdin() {
  if (options.password !== undefined) {
    throw new Error("--password is forbidden; provide the password through stdin");
  }
  const password = readFileSync(0, "utf8").replace(/\r?\n$/, "");
  if (!/^[\x21-\x7e]{8}$/.test(password)) {
    throw new Error("Password from stdin must contain exactly 8 printable characters without spaces");
  }
  return password;
}

function readBootstrapSecretFromStdin(kind: "password" | "totp" | "recovery") {
  if (options.password !== undefined || options.code !== undefined) {
    throw new Error("--password and --code are forbidden; provide secrets through stdin");
  }
  const value = readFileSync(0, "utf8").trim();
  if (kind === "password" && (!/^[\x21-\x7e]{16,128}$/.test(value))) {
    throw new Error("Bootstrap password must contain 16-128 printable characters without spaces");
  }
  if (kind === "totp" && !/^\d{6}$/.test(value)) {
    throw new Error("TOTP code from stdin must contain exactly 6 digits");
  }
  if (kind === "recovery" && !/^[A-Za-z0-9]{24}$/.test(value)) {
    throw new Error("Recovery code from stdin is invalid");
  }
  return value;
}

function requireAuthSecret() {
  const environment = readAuthEnvironment();
  if (!environment) {
    throw new Error("BETTER_AUTH_SECRET and BETTER_AUTH_URL are required");
  }
  return environment.secret;
}

function resolveMaterialOutput() {
  const materialOutput = requireOption("material-output");
  if (!isAbsolute(materialOutput)) {
    throw new Error("--material-output must be an absolute path outside the repository");
  }
  const resolvedMaterialOutput = resolve(materialOutput);
  const repositoryRelativePath = relative(process.cwd(), resolvedMaterialOutput);
  const isInsideRepository = repositoryRelativePath === "" || (
    !isAbsolute(repositoryRelativePath) &&
    repositoryRelativePath !== ".." &&
    !repositoryRelativePath.startsWith(`..${sep}`)
  );
  if (isInsideRepository) {
    throw new Error("Recovery material must be written outside the repository");
  }
  return resolvedMaterialOutput;
}

function writeRecoveryMaterial(input: {
  path: string;
  username: string;
  status: "awaiting_totp_verification" | "awaiting_recovery_totp_verification";
  totpUri: string;
  recoveryCodes: string[];
}) {
  writeFileSync(input.path, `${JSON.stringify({
    status: input.status,
    username: input.username,
    totpUri: input.totpUri,
    recoveryCodes: input.recoveryCodes,
    warning: "Move this file to offline storage and securely remove the workstation copy.",
  }, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
}

async function assertLegacyPlatformAdmin(username: string) {
  const [adminCount, user] = await Promise.all([
    prisma.user.count({ where: { systemRole: SystemRole.PLATFORM_ADMIN } }),
    prisma.user.findUnique({
      where: { username },
      include: {
        twoFactor: true,
        adminRecoveryCodes: { select: { id: true } },
        accounts: {
          where: { providerId: "credential" },
          select: { id: true, password: true },
        },
      },
    }),
  ]);

  if (
    adminCount !== 1 ||
    !user ||
    user.systemRole !== SystemRole.PLATFORM_ADMIN ||
    user.disabledAt ||
    user.twoFactorEnabled ||
    user.twoFactor ||
    user.adminRecoveryCodes.length > 0 ||
    user.accounts.length !== 1 ||
    !user.accounts[0]?.password
  ) {
    throw new Error("Eligible legacy Platform Admin account not found");
  }

  return { user, credentialAccountId: user.accounts[0].id };
}

async function findUserByUsername(username: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    throw new Error(`User not found: ${username}`);
  }
  return user;
}

function parseTenantRole(value: string | undefined): MembershipRole {
  if (!value || value === "VIEWER") return MembershipRole.VIEWER;
  if (value === "ORG_OWNER") return MembershipRole.ORG_OWNER;
  if (value === "ORG_MEMBER") return MembershipRole.ORG_MEMBER;
  throw new Error("--tenant-role must be ORG_OWNER, ORG_MEMBER or VIEWER");
}

async function createUser() {
  const username = requireUsername();
  const email = (options.email ?? `${username}@users.impulse.invalid`).toLowerCase();
  const name = requireOption("name");
  const password = readPasswordFromStdin();
  const systemRole = parseSystemRole(options["system-role"] ?? SystemRole.CLIENT);
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
  });

  if (existingUser) {
    throw new Error(`User already exists: ${username}`);
  }

  const userId = randomUUID();
  const passwordHash = await hashPassword(password);
  const issuer = createLocalAccountIssuer("credential");

  await prisma.$transaction([
    prisma.user.create({
      data: {
        id: userId,
        username,
        email,
        name,
        emailVerified: false,
        systemRole,
      },
    }),
    prisma.account.create({
      data: {
        id: randomUUID(),
        userId,
        providerId: "credential",
        issuer,
        accountId: userId,
        password: passwordHash,
      },
    }),
  ]);

  console.log(`created_user=${username}`);
}

async function resetPassword() {
  const username = requireUsername();
  const password = readPasswordFromStdin();
  const user = await findUserByUsername(username);
  const passwordHash = await hashPassword(password);
  const credential = {
    userId: user.id,
    providerId: "credential",
    issuer: createLocalAccountIssuer("credential"),
    accountId: user.id,
  };

  await prisma.$transaction(async (transaction) => {
    await transaction.account.upsert({
      where: {
        issuer_accountId: {
          issuer: credential.issuer,
          accountId: credential.accountId,
        },
      },
      update: { userId: user.id, providerId: "credential", password: passwordHash },
      create: { id: randomUUID(), ...credential, password: passwordHash },
    });
    await transaction.session.deleteMany({ where: { userId: user.id } });
  });

  console.log(`reset_password=${username}`);
}

async function disableUser() {
  const username = requireUsername();
  const user = await findUserByUsername(username);
  const lockedPassword = await hashPassword(randomUUID());

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.account.updateMany({
      where: {
        userId: user.id,
        providerId: "credential",
      },
      data: {
        password: lockedPassword,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { disabledAt: new Date() },
    }),
  ]);

  console.log(`disabled_user=${username}`);
}

async function setSystemRole() {
  const username = requireUsername();
  const systemRole = parseSystemRole(requireOption("system-role"));
  if (systemRole === SystemRole.PLATFORM_ADMIN) {
    throw new Error("Generic role assignment cannot grant PLATFORM_ADMIN; use the controlled bootstrap");
  }
  const user = await findUserByUsername(username);

  await prisma.user.update({
    where: { id: user.id },
    data: { systemRole },
  });

  console.log(`updated_system_role=${username}`);
}

async function assertPlatformAdminBootstrapOpen() {
  const activeAdmin = await prisma.user.findFirst({
    where: { systemRole: SystemRole.PLATFORM_ADMIN },
    select: { id: true },
  });
  if (activeAdmin) {
    throw new Error("Platform Admin bootstrap is permanently closed");
  }
}

async function bootstrapPlatformAdmin() {
  await assertPlatformAdminBootstrapOpen();
  const username = requireUsername();
  const email = requireOption("email").trim().toLowerCase();
  const name = requireOption("name").trim();
  const password = readBootstrapSecretFromStdin("password");
  const authSecret = requireAuthSecret();
  const resolvedMaterialOutput = resolveMaterialOutput();
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { id: true },
  });
  if (existingUser) throw new Error("Bootstrap identity already exists");

  const userId = randomUUID();
  const secret = generateRandomString(32);
  const passwordHash = await hashPassword(password);
  const encryptedSecret = await symmetricEncrypt({ key: authSecret, data: secret });
  const disabledBetterAuthBackupCodes = await symmetricEncrypt({ key: authSecret, data: "[]" });
  const recovery = createPlatformAdminRecoveryBatch(userId);
  const totpUri = createOTP(secret, { digits: 6, period: 30 }).url("AMS IMPULSE", email);
  writeRecoveryMaterial({
    path: resolvedMaterialOutput,
    username,
    totpUri,
    status: "awaiting_totp_verification",
    recoveryCodes: recovery.codes,
  });

  await prisma.$transaction([
    prisma.user.create({
      data: {
        id: userId,
        username,
        email,
        name,
        emailVerified: true,
        systemRole: SystemRole.CLIENT,
        twoFactorEnabled: false,
      },
    }),
    prisma.account.create({
      data: {
        id: randomUUID(),
        userId,
        providerId: "credential",
        issuer: createLocalAccountIssuer("credential"),
        accountId: userId,
        password: passwordHash,
      },
    }),
    prisma.twoFactor.create({
      data: {
        id: randomUUID(),
        userId,
        secret: encryptedSecret,
        backupCodes: disabledBetterAuthBackupCodes,
        verified: false,
      },
    }),
    prisma.platformAdminRecoveryCode.createMany({ data: recovery.records }),
  ]);

  console.log(`platform_admin_bootstrap_material=${resolvedMaterialOutput}`);
  console.log(`platform_admin_bootstrap_pending=${username}`);
}

async function verifyPlatformAdminBootstrap() {
  await assertPlatformAdminBootstrapOpen();
  const username = requireUsername();
  const code = readBootstrapSecretFromStdin("totp");
  const authSecret = requireAuthSecret();
  const user = await prisma.user.findUnique({
    where: { username },
    include: { twoFactor: true },
  });
  if (!user || user.systemRole !== SystemRole.CLIENT || user.twoFactorEnabled) {
    throw new Error("Pending Platform Admin bootstrap not found");
  }
  if (!user.twoFactor || user.twoFactor.verified) {
    throw new Error("Pending TOTP enrollment not found");
  }
  const secret = await symmetricDecrypt({ key: authSecret, data: user.twoFactor.secret });
  if (!(await createOTP(secret, { digits: 6, period: 30 }).verify(code, { window: 1 }))) {
    throw new Error("TOTP verification failed");
  }

  const correlationId = randomUUID();
  await prisma.$transaction(async (transaction) => {
    const concurrentAdmin = await transaction.user.findFirst({
      where: { systemRole: SystemRole.PLATFORM_ADMIN },
      select: { id: true },
    });
    if (concurrentAdmin) throw new Error("Platform Admin bootstrap is permanently closed");
    await transaction.twoFactor.update({
      where: { userId: user.id },
      data: { verified: true, failedVerificationCount: 0, lockedUntil: null },
    });
    await transaction.user.update({
      where: { id: user.id },
      data: { systemRole: SystemRole.PLATFORM_ADMIN, twoFactorEnabled: true },
    });
    await transaction.session.deleteMany({ where: { userId: user.id } });
    await transaction.auditEvent.create({
      data: {
        actorType: "SYSTEM",
        action: "platform-admin.bootstrap.completed",
        entityType: "User",
        entityId: user.id,
        afterMarker: { username, totpVerified: true },
        source: "owner-cli",
        correlationId,
      },
    });
  }, { isolationLevel: "Serializable" });

  console.log(`platform_admin_bootstrap_completed=${username}`);
}

async function adoptLegacyPlatformAdmin() {
  const username = requireUsername();
  const password = readBootstrapSecretFromStdin("password");
  const authSecret = requireAuthSecret();
  const resolvedMaterialOutput = resolveMaterialOutput();
  const { user, credentialAccountId } = await assertLegacyPlatformAdmin(username);
  const secret = generateRandomString(32);
  const passwordHash = await hashPassword(password);
  const encryptedSecret = await symmetricEncrypt({ key: authSecret, data: secret });
  const disabledBetterAuthBackupCodes = await symmetricEncrypt({ key: authSecret, data: "[]" });
  const recovery = createPlatformAdminRecoveryBatch(user.id);
  const totpUri = createOTP(secret, { digits: 6, period: 30 }).url("AMS IMPULSE", user.email);

  writeRecoveryMaterial({
    path: resolvedMaterialOutput,
    username,
    totpUri,
    status: "awaiting_totp_verification",
    recoveryCodes: recovery.codes,
  });

  const correlationId = randomUUID();
  try {
    await prisma.$transaction(async (transaction) => {
      const adminCount = await transaction.user.count({
        where: { systemRole: SystemRole.PLATFORM_ADMIN },
      });
      const currentUser = await transaction.user.findUnique({
        where: { id: user.id },
        include: {
          twoFactor: true,
          accounts: {
            where: { id: credentialAccountId, providerId: "credential" },
            select: { id: true, password: true },
          },
        },
      });
      const recoveryCodeCount = await transaction.platformAdminRecoveryCode.count({
        where: { userId: user.id },
      });
      if (
        adminCount !== 1 ||
        !currentUser ||
        currentUser.systemRole !== SystemRole.PLATFORM_ADMIN ||
        currentUser.disabledAt ||
        currentUser.twoFactorEnabled ||
        currentUser.twoFactor ||
        recoveryCodeCount > 0 ||
        currentUser.accounts.length !== 1 ||
        !currentUser.accounts[0]?.password
      ) {
        throw new Error("Legacy Platform Admin state changed; adoption aborted");
      }

      await transaction.account.update({
        where: { id: credentialAccountId },
        data: { password: passwordHash },
      });
      await transaction.twoFactor.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          secret: encryptedSecret,
          backupCodes: disabledBetterAuthBackupCodes,
          verified: false,
        },
      });
      await transaction.platformAdminRecoveryCode.createMany({ data: recovery.records });
      await transaction.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: false },
      });
      await transaction.session.deleteMany({ where: { userId: user.id } });
      await transaction.auditEvent.create({
        data: {
          actorType: "SYSTEM",
          action: "platform-admin.legacy-adoption.started",
          entityType: "User",
          entityId: user.id,
          beforeMarker: { totpEnrolled: false },
          afterMarker: {
            passwordRotated: true,
            sessionsRevoked: true,
            totpVerified: false,
            recoveryBatchCreated: true,
          },
          source: "owner-cli",
          correlationId,
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    unlinkSync(resolvedMaterialOutput);
    throw error;
  }

  console.log(`platform_admin_adoption_material=${resolvedMaterialOutput}`);
  console.log(`platform_admin_adoption_pending=${username}`);
}

async function verifyPlatformAdminAdoption() {
  const username = requireUsername();
  const code = readBootstrapSecretFromStdin("totp");
  const authSecret = requireAuthSecret();
  const user = await prisma.user.findUnique({
    where: { username },
    include: { twoFactor: true },
  });
  if (
    !user ||
    user.systemRole !== SystemRole.PLATFORM_ADMIN ||
    user.disabledAt ||
    user.twoFactorEnabled ||
    !user.twoFactor ||
    user.twoFactor.verified
  ) {
    throw new Error("Pending legacy Platform Admin adoption not found");
  }
  const adoptionStarted = await prisma.auditEvent.findFirst({
    where: {
      action: "platform-admin.legacy-adoption.started",
      entityType: "User",
      entityId: user.id,
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!adoptionStarted) {
    throw new Error("Pending legacy Platform Admin adoption audit marker not found");
  }
  const secret = await symmetricDecrypt({ key: authSecret, data: user.twoFactor.secret });
  if (!(await createOTP(secret, { digits: 6, period: 30 }).verify(code, { window: 1 }))) {
    throw new Error("TOTP verification failed");
  }

  const correlationId = randomUUID();
  await prisma.$transaction(async (transaction) => {
    const currentUser = await transaction.user.findUnique({
      where: { id: user.id },
      include: { twoFactor: true },
    });
    if (
      !currentUser ||
      currentUser.systemRole !== SystemRole.PLATFORM_ADMIN ||
      currentUser.disabledAt ||
      currentUser.twoFactorEnabled ||
      !currentUser.twoFactor ||
      currentUser.twoFactor.verified
    ) {
      throw new Error("Legacy Platform Admin state changed; verification aborted");
    }
    await transaction.twoFactor.update({
      where: { userId: user.id },
      data: { verified: true, failedVerificationCount: 0, lockedUntil: null },
    });
    await transaction.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });
    await transaction.session.deleteMany({ where: { userId: user.id } });
    await transaction.auditEvent.create({
      data: {
        actorType: "SYSTEM",
        action: "platform-admin.legacy-adoption.completed",
        entityType: "User",
        entityId: user.id,
        afterMarker: { totpVerified: true, sessionsRevoked: true },
        source: "owner-cli",
        correlationId,
      },
    });
  }, { isolationLevel: "Serializable" });

  console.log(`platform_admin_adoption_completed=${username}`);
}

async function recoverPlatformAdmin() {
  const username = requireUsername();
  const recoveryCode = readBootstrapSecretFromStdin("recovery");
  const recoveryCodeHash = hashPlatformAdminRecoveryCode(recoveryCode);
  const authSecret = requireAuthSecret();
  const resolvedMaterialOutput = resolveMaterialOutput();
  const user = await prisma.user.findUnique({
    where: { username },
    include: { twoFactor: true },
  });
  if (
    !user ||
    user.systemRole !== SystemRole.PLATFORM_ADMIN ||
    !user.twoFactorEnabled ||
    !user.twoFactor?.verified
  ) {
    throw new Error("Active Platform Admin TOTP enrollment not found");
  }
  const availableRecoveryCode = await prisma.platformAdminRecoveryCode.findUnique({
    where: { userId_codeHash: { userId: user.id, codeHash: recoveryCodeHash } },
  });
  if (!availableRecoveryCode || availableRecoveryCode.consumedAt || availableRecoveryCode.revokedAt) {
    throw new Error("Recovery code is invalid or no longer active");
  }

  const newSecret = generateRandomString(32);
  const encryptedSecret = await symmetricEncrypt({ key: authSecret, data: newSecret });
  const disabledBetterAuthBackupCodes = await symmetricEncrypt({ key: authSecret, data: "[]" });
  const recovery = createPlatformAdminRecoveryBatch(user.id);
  const totpUri = createOTP(newSecret, { digits: 6, period: 30 }).url(
    "AMS IMPULSE",
    user.email,
  );
  writeRecoveryMaterial({
    path: resolvedMaterialOutput,
    username,
    totpUri,
    status: "awaiting_recovery_totp_verification",
    recoveryCodes: recovery.codes,
  });

  const now = new Date();
  const correlationId = randomUUID();
  await prisma.$transaction(async (transaction) => {
    const currentCode = await transaction.platformAdminRecoveryCode.findUnique({
      where: { userId_codeHash: { userId: user.id, codeHash: recoveryCodeHash } },
    });
    if (!currentCode || currentCode.consumedAt || currentCode.revokedAt) {
      throw new Error("Recovery code is invalid or no longer active");
    }
    await transaction.platformAdminRecoveryCode.updateMany({
      where: { userId: user.id, consumedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    await transaction.platformAdminRecoveryCode.update({
      where: { id: currentCode.id },
      data: { consumedAt: now, revokedAt: null },
    });
    await transaction.platformAdminRecoveryCode.createMany({ data: recovery.records });
    await transaction.twoFactor.update({
      where: { userId: user.id },
      data: {
        secret: encryptedSecret,
        backupCodes: disabledBetterAuthBackupCodes,
        verified: false,
        failedVerificationCount: 0,
        lockedUntil: null,
      },
    });
    await transaction.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false },
    });
    await transaction.session.deleteMany({ where: { userId: user.id } });
    await transaction.auditEvent.create({
      data: {
        actorType: "SYSTEM",
        action: "platform-admin.recovery.started",
        entityType: "User",
        entityId: user.id,
        beforeMarker: { totpVerified: true },
        afterMarker: { totpVerified: false, sessionsRevoked: true, recoveryBatchRotated: true },
        source: "owner-cli",
        correlationId,
      },
    });
  }, { isolationLevel: "Serializable" });

  console.log(`platform_admin_recovery_material=${resolvedMaterialOutput}`);
  console.log(`platform_admin_recovery_pending=${username}`);
}

async function verifyPlatformAdminRecovery() {
  const username = requireUsername();
  const code = readBootstrapSecretFromStdin("totp");
  const authSecret = requireAuthSecret();
  const user = await prisma.user.findUnique({
    where: { username },
    include: { twoFactor: true },
  });
  if (
    !user ||
    user.systemRole !== SystemRole.PLATFORM_ADMIN ||
    user.twoFactorEnabled ||
    !user.twoFactor ||
    user.twoFactor.verified
  ) {
    throw new Error("Pending Platform Admin recovery not found");
  }
  const secret = await symmetricDecrypt({ key: authSecret, data: user.twoFactor.secret });
  if (!(await createOTP(secret, { digits: 6, period: 30 }).verify(code, { window: 1 }))) {
    throw new Error("TOTP verification failed");
  }

  const correlationId = randomUUID();
  await prisma.$transaction(async (transaction) => {
    await transaction.twoFactor.update({
      where: { userId: user.id },
      data: { verified: true, failedVerificationCount: 0, lockedUntil: null },
    });
    await transaction.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });
    await transaction.session.deleteMany({ where: { userId: user.id } });
    await transaction.auditEvent.create({
      data: {
        actorType: "SYSTEM",
        action: "platform-admin.recovery.completed",
        entityType: "User",
        entityId: user.id,
        afterMarker: { totpVerified: true, sessionsRevoked: true },
        source: "owner-cli",
        correlationId,
      },
    });
  }, { isolationLevel: "Serializable" });

  console.log(`platform_admin_recovery_completed=${username}`);
}

async function addToOrganization() {
  const username = requireUsername();
  const organizationSlug = requireOption("organization");
  const tenantRole = parseTenantRole(options["tenant-role"]);
  const user = await findUserByUsername(username);
  const organization = await prisma.organization.findUnique({ where: { slug: organizationSlug } });

  if (!organization) {
    throw new Error(`Organization not found: ${organizationSlug}`);
  }

  await prisma.member.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id,
      },
    },
    update: { tenantRole },
    create: {
      organizationId: organization.id,
      userId: user.id,
      tenantRole,
    },
  });

  console.log(`organization_member=${organizationSlug}:${username}`);
}

async function removeFromOrganization() {
  const username = requireUsername();
  const organizationSlug = requireOption("organization");
  const user = await findUserByUsername(username);
  const organization = await prisma.organization.findUnique({ where: { slug: organizationSlug } });

  if (!organization) {
    throw new Error(`Organization not found: ${organizationSlug}`);
  }

  await prisma.member.deleteMany({
    where: {
      organizationId: organization.id,
      userId: user.id,
    },
  });

  console.log(`organization_member_removed=${organizationSlug}:${username}`);
}

async function main() {
  switch (command) {
    case "create":
      await createUser();
      return;
    case "disable":
      await disableUser();
      return;
    case "reset-password":
      await resetPassword();
      return;
    case "set-system-role":
      await setSystemRole();
      return;
    case "bootstrap-platform-admin":
      await bootstrapPlatformAdmin();
      return;
    case "verify-platform-admin-bootstrap":
      await verifyPlatformAdminBootstrap();
      return;
    case "adopt-legacy-platform-admin":
      await adoptLegacyPlatformAdmin();
      return;
    case "verify-platform-admin-adoption":
      await verifyPlatformAdminAdoption();
      return;
    case "recover-platform-admin":
      await recoverPlatformAdmin();
      return;
    case "verify-platform-admin-recovery":
      await verifyPlatformAdminRecovery();
      return;
    case "add-to-organization":
      await addToOrganization();
      return;
    case "remove-from-organization":
      await removeFromOrganization();
      return;
    default:
      throw new Error(`Unsupported command: ${command ?? "<missing>"}`);
  }
}

main()
  .finally(async () => {
    await database.close();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
