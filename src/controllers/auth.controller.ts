import { TryCatch } from "../utils/tryCatch.js";
import sanitize from "mongo-sanitize";
import { LoginSchema, registerSchema } from "../validators/auth.validator.js";
import ErrorHandler from "../utils/errorHandler.js";
import { redisClient } from "../config/redis.js";
import { User } from "../models/auth.models.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import sendMail from "../utils/sendMail.js";
import { getOtpHtml, getVerifyEmailHtml } from "../utils/html.js";
import {
  generateAccessToken,
  generateToken,
  verifyRefreshToken,
} from "../utils/generateToken.js";

export const registerUser = TryCatch(async (req, res) => {
  const sanitizedBody = sanitize(req.body);

  const validation = registerSchema.safeParse(sanitizedBody);

  if (!validation.success) {
    const zodError = validation.error;

    let firstErrorMessage = "Validation failed!";
    let allErrors: { field: string; message: string; code: string }[] = [];

    if (zodError?.issues && Array.isArray(zodError.issues)) {
      allErrors = zodError.issues.map((issue) => ({
        field: issue.path ? issue.path.join(".") : "unknown",
        message: issue.message || "Validation error!",
        code: issue.code,
      }));

      firstErrorMessage = allErrors[0]?.message || "Validation error!";
    }
    throw new ErrorHandler(400, firstErrorMessage);
  }

  const { name, email, password } = validation.data;

  //Rate limiting via email and ip

  const ratelimitKey = `register-rate-limit:${req.ip}:${email}`;

  if (await redisClient.get(ratelimitKey)) {
    throw new ErrorHandler(429, "Too many requests, try again later");
  }

  const exitingUser = await User.findOne({ email });

  if (exitingUser) {
    throw new ErrorHandler(400, "User Already exists!");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // verify the user

  const verifyToken = crypto.randomBytes(32).toString("hex");

  const verifyKey = `verify:${verifyToken}`;

  const dataToStore = JSON.stringify({
    name,
    email,
    password: hashedPassword,
  });

  await redisClient.set(verifyKey, dataToStore, { EX: 300 });

  const subject = "Verify your email for account creation";
  const html = getVerifyEmailHtml({ email, token: verifyToken });

  await sendMail({ email, subject, html });

  await redisClient.set(ratelimitKey, "true", { EX: 60 });

  res.json({
    message:
      "If your email is valid, a verification link has been sent. it will expire in 5 minutes",
  });
});

export const verifyUser = TryCatch(async (req, res) => {
  const { token } = req.params;

  if (!token) {
    throw new ErrorHandler(400, "Verification token is required");
  }

  const verifyKey = `verify:${token}`;

  const userDataJSON = await redisClient.get(verifyKey);

  if (!userDataJSON) {
    throw new ErrorHandler(400, "Verification link is expired.");
  }

  await redisClient.del(verifyKey);

  const userData = JSON.parse(userDataJSON);

  const exitingUser = await User.findOne({ email: userData.email });

  if (exitingUser) {
    throw new ErrorHandler(400, "User Already exists!");
  }

  const newUser = await User.create({
    name: userData.name,
    email: userData.email,
    password: userData.password,
  });

  res.status(201).json({
    message: "Email verified successfully!. Your account has been created.",
    user: { _id: newUser._id, name: newUser.name, email: newUser.email },
  });
});

export const loginUser = TryCatch(async (req, res) => {
  const sanitizedBody = sanitize(req.body);

  const validation = LoginSchema.safeParse(sanitizedBody);

  if (!validation.success) {
    const zodError = validation.error;

    let firstErrorMessage = "Validation failed!";
    let allErrors: { field: string; message: string; code: string }[] = [];

    if (zodError?.issues && Array.isArray(zodError.issues)) {
      allErrors = zodError.issues.map((issue) => ({
        field: issue.path ? issue.path.join(".") : "unknown",
        message: issue.message || "Validation error!",
        code: issue.code,
      }));

      firstErrorMessage = allErrors[0]?.message || "Validation error!";
    }
    throw new ErrorHandler(400, firstErrorMessage);
  }

  const { email, password } = validation.data;

  // rate limit

  const ratelimitKey = `login-rate-limit:${req.ip}:${email}`;

  if (await redisClient.get(ratelimitKey)) {
    throw new ErrorHandler(429, "Too many requests, try again later");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ErrorHandler(400, "Invalid credentials!");
  }

  const comparePassword = await bcrypt.compare(password, user.password);

  if (!comparePassword) {
    throw new ErrorHandler(400, "Invalid credentials!");
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const optKey = `otp:${email}`;

  await redisClient.set(optKey, JSON.stringify(otp), {
    EX: 300,
  });

  const subject = "OTP for verification";

  const html = getOtpHtml({ email, otp });

  await sendMail({ email, subject, html });

  await redisClient.set(ratelimitKey, "true", { EX: 60 });

  res.json({
    message:
      "If your email is valid, an otp has been sent. It will be valid for 5 min",
  });
});

export const verifyOtp = TryCatch(async (req, res) => {
  // we will store email in cookie after login and we will get
  // email from that cookie and send via body
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new ErrorHandler(400, "Please provide all details");
  }

  const otpKey = `otp:${email}`;

  const storedOtpString = await redisClient.get(otpKey);

  if (!storedOtpString) {
    throw new ErrorHandler(400, "OTP expired!");
  }

  const storedOtp = JSON.parse(storedOtpString);

  if (storedOtp !== otp) {
    throw new ErrorHandler(400, "Invalid OTP");
  }

  await redisClient.del(otpKey);

  let user = await User.findOne({ email });

  if (!user) {
    throw new ErrorHandler(404, "User not found!");
  }

  const tokenData = await generateToken(user._id, res);

  res.json({
    message: `Welcome ${user.name}`,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
    },
  });
});

export const MyProfile = TryCatch(async (req, res) => {
  const user = req.user;

  res.json(user);
});

export const refreshToken = TryCatch(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    throw new ErrorHandler(401, "Invalid refresh token!");
  }

  const decode = await verifyRefreshToken(refreshToken);

  if (!decode) {
    throw new ErrorHandler(401, "Invalid refresh token!");
  }

  generateAccessToken(decode.id, res);

  res.json({
    message: "Token refreshed!",
  });
});

export const logoutUser = TryCatch(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ErrorHandler(401, "Not authenticated");
  }

  await redisClient.del(`refresh_token:${userId}`);

  res.clearCookie("refreshToken");
  res.clearCookie("accessToken");

  await redisClient.del(`user:${userId}`);

  res.json({
    message: "Logged out successfully",
  });
});
