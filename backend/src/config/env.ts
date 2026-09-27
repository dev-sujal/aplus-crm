import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  mongoUri: required("MONGO_URI", "mongodb://127.0.0.1:27017/aplus-crm"),
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",

  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me"),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  jwtRefreshExpiresInDays: Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? 30),

  // 32-byte (64 hex char) key used to reversibly encrypt admin passwords so
  // the Owner can view them. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  passwordEncryptionKey: required(
    "PASSWORD_ENCRYPTION_KEY",
    "0000000000000000000000000000000000000000000000000000000000000000".slice(0, 64)
  ),

  ownerSeedEmail: process.env.OWNER_SEED_EMAIL ?? "owner@aplus.test",
  ownerSeedPassword: process.env.OWNER_SEED_PASSWORD ?? "ChangeMe123!",

  centreName: process.env.CENTRE_NAME ?? "A+ Coaching Centre",
  // Base URL the public verify page and certificate QR codes point to.
  publicAppUrl: process.env.PUBLIC_APP_URL ?? process.env.CLIENT_URL ?? "http://localhost:5173",
};

export const isProd = env.nodeEnv === "production";
