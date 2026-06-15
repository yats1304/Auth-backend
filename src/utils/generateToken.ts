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
      expiresIn: "15m",
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
    maxAge: 15 * 60 * 1000,
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

export const verifyRefreshToken = async (refreshToken: string) => {
  try {
    const decode = jwt.verify(
      refreshToken,
      process.env.REFRESH_SECRET as string,
    ) as { id: string };

    const storeToken = await redisClient.get(`refresh_token:${decode.id}`);

    if (storeToken === refreshToken) {
      return decode;
    }
    return null;
  } catch (error) {
    return null;
  }
};

export const generateAccessToken = (
  id: string | mongoose.Types.ObjectId,
  res: Response,
) => {
  const accessToken = jwt.sign({ id }, process.env.ACCESS_SECRET as string, {
    expiresIn: "15m",
  });

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    // secure: true,
    sameSite: "none",
    maxAge: 15 * 60 * 1000,
  });
};
