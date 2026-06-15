import jwt from "jsonwebtoken";
import { Response } from "express";
import mongoose from "mongoose";
import { redisClient } from "../config/redis.js";

export const generateToken = async (
  id: string | mongoose.Types.ObjectId,
  res: Response,
) => {
  const userId = id.toString();

  const accessToken = jwt.sign(
    { id: userId },
    process.env.ACCESS_SECRET as string,
    {
      // for testing it have exp time as 1m but in production change to 15m
      expiresIn: "1m",
    },
  );

  const refreshToken = jwt.sign(
    { id: userId },
    process.env.REFRESH_SECRET as string,
    {
      expiresIn: "7d",
    },
  );

  const refreshTokenKey = `refresh_token:${userId}`;

  await redisClient.setEx(refreshTokenKey, 7 * 24 * 60 * 60, refreshToken);

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    // secure: true,
    sameSite: "none",
    // for dev purpose we are keeping it for 1 min
    maxAge: 1 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    // secure: true,
    sameSite: "none",
    // 7 days
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return { accessToken, refreshToken };
};
