import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();
const redisURL = process.env.REDIS_URL;

if (!redisURL) {
  throw new Error("Missing REDIS_URL in .env");
}

export const redisClient = createClient({ url: redisURL });

export const connectRedis = async () => {
  await redisClient
    .connect()
    .then(() => console.log("Connected to Redis✅"))
    .catch((error) => {
      console.error("Failed to connect to Redis❌", error.message);
    });
};
