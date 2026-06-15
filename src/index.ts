import express from "express";
import dotenv from "dotenv";
import connectDB from "./db/db.js";
import { connectRedis } from "./config/redis.js";
import authRoutes from "./routes/auth.routes.js";

dotenv.config();

await connectDB();
await connectRedis();

const app = express();

// middlewares
app.use(express.json());

// routes
app.use("/api/v1", authRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});
