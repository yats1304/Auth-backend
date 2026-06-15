import jwt from "jsonwebtoken";
import { TryCatch } from "../utils/tryCatch.js";
import ErrorHandler from "../utils/errorHandler.js";
import { redisClient } from "../config/redis.js";
import { User } from "../models/auth.models.js";

export const isAuth = TryCatch(async (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    throw new ErrorHandler(403, "Please Login - no token");
  }

  const decodedData = jwt.verify(
    token,
    process.env.ACCESS_SECRET as string,
  ) as { id: string };

  if (!decodedData) {
    throw new ErrorHandler(400, "Token is expired!");
  }

  //   caching user data to redis

  const cachedUser = await redisClient.get(`user:${decodedData.id}`);

  if (cachedUser) {
    req.user = JSON.parse(cachedUser);
    return next();
  }

  const user = await User.findById(decodedData.id).select("-password");

  if (!user) {
    throw new ErrorHandler(400, "No user with id");
  }

  await redisClient.setEx(`user:${user._id}`, 3600, JSON.stringify(user));

  req.user = user;
  return next();
});
