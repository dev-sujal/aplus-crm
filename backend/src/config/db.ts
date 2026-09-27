import mongoose from "mongoose";
import { env } from "./env.js";

mongoose.set("strictQuery", true);

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
