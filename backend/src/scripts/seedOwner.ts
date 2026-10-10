import { connectDB, disconnectDB } from "../config/db.js";
import { User } from "../models/User.model.js";
import { hashPassword } from "../utils/password.js";
import { defaultPermissions } from "../types/permissions.js";
import { env } from "../config/env.js";

async function seedOwner() {
  await connectDB();

  const existingOwner = await User.findOne({ role: "owner" });
  if (existingOwner) {
    console.log(`[seed] Owner already exists: ${existingOwner.email}`);
    await disconnectDB();
    return;
  }

  const passwordHash = await hashPassword(env.ownerSeedPassword);
  const allPermissions = Object.fromEntries(
    Object.entries(defaultPermissions()).map(([mod]) => [mod, { view: true, edit: true }])
  );

  const owner = await User.create({
    firstName: "Centre",
    lastName: "Owner",
    email: env.ownerSeedEmail,
    passwordHash,
    role: "owner",
    permissions: allPermissions,
    status: "active",
  });

  console.log(`[seed] Owner created: ${owner.email}`);
  console.log(`[seed] Temporary password: ${env.ownerSeedPassword}`);
  console.log("[seed] Please log in and change this password immediately.");

  await disconnectDB();
}

seedOwner().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
