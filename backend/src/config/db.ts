import mongoose from "mongoose";
import { env } from "./env.js";

mongoose.set("strictQuery", true);

// Every API response exposes `id` (string) alongside `_id`, and hides __v.
// The frontend types and components are written against `id`.
mongoose.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    if (ret._id !== undefined && ret.id === undefined) ret.id = String(ret._id);
    return ret;
  },
});

export async function connectDB(): Promise<void> {
  mongoose.connection.on("connected", () => {
    console.log("[db] MongoDB connected");
  });
  mongoose.connection.on("error", (err) => {
    console.error("[db] MongoDB connection error:", err);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("[db] MongoDB disconnected");
  });

  await mongoose.connect(env.mongoUri);
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
