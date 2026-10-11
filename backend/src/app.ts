import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import { env, isProd } from "./config/env.js";
import apiRouter from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";

const app = express();

// const allowedOrigins = new Set([
//   env.clientUrl,
//   env.clientUrl.replace("localhost", "127.0.0.1"),
// ]);

app.use(helmet());
// app.use(
//   cors({
//     origin(origin, callback) {
//       if (!origin || allowedOrigins.has(origin)) {
//         callback(null, true);
//         return;
//       }

//       callback(new Error(`CORS blocked for origin: ${origin}`));
//     },
//     credentials: true,
//   })
// );
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(isProd ? "combined" : "dev"));

app.use("/api/v1", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
