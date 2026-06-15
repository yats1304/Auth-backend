import { TryCatch } from "../utils/tryCatch.js";
import sanitize from "mongo-sanitize";
import { registerSchema } from "../validators/auth.validator.js";
import ErrorHandler from "../utils/errorHandler.js";
import { redisClient } from "../config/redis.js";
import { User } from "../models/auth.models.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import sendMail from "../utils/sendMail.js";
import { getVerifyEmailHtml } from "../utils/html.js";

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
