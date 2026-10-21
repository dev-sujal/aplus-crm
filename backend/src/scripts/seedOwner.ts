import { pathToFileURL } from "node:url";
import { connectDB, disconnectDB } from "../config/db.js";
import { env } from "../config/env.js";
import { User } from "../models/User.model.js";
import { defaultPermissions } from "../types/permissions.js";
import { hashPassword } from "../utils/password.js";

type OwnerSeedRecord = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: "owner";
  permissions: ReturnType<typeof buildAllPermissions>;
  status: "active";
};

export function buildAllPermissions() {
  return Object.fromEntries(
    Object.entries(defaultPermissions()).map(([mod]) => [mod, { view: true, edit: true }])
  );
}

export function buildOwnerSeedRecords(): OwnerSeedRecord[] {
  const allPermissions = buildAllPermissions();

  return [
    {
      firstName: "Abhishek",
      lastName: "Sharma",
      email: env.ownerSeedEmail,
      password: env.ownerSeedPassword,
      role: "owner",
      permissions: allPermissions,
      status: "active",
    },
    {
      firstName: "Sujal",
      lastName: "Dev",
      email: "dev@mail.com",
      password: "dev123",
      role: "owner",
      permissions: allPermissions,
      status: "active",
    },
  ];
}

export async function seedOwners() {
  await connectDB();

  const uniqueOwnerSeeds = Array.from(
    new Map(
      buildOwnerSeedRecords().map((ownerSeed) => [ownerSeed.email.toLowerCase(), ownerSeed])
    ).values()
  );

  for (const ownerSeed of uniqueOwnerSeeds) {
    const existingOwner = await User.findOne({ email: ownerSeed.email.toLowerCase() });
    if (existingOwner) {
      console.log(`[seed] Owner already exists: ${existingOwner.email}`);
      continue;
    }

    const passwordHash = await hashPassword(ownerSeed.password);
    const owner = await User.create({
      firstName: ownerSeed.firstName,
      lastName: ownerSeed.lastName,
      email: ownerSeed.email,
      passwordHash,
      role: ownerSeed.role,
      permissions: ownerSeed.permissions,
      status: ownerSeed.status,
    });

    console.log(`[seed] Owner created: ${owner.email}`);
    console.log(`[seed] Temporary password: ${ownerSeed.password}`);
  }

  console.log("[seed] Please log in and change these passwords immediately.");
  await disconnectDB();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedOwners().catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
}
