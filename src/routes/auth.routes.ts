import express from "express";
import {
  loginUser,
  logoutUser,
  MyProfile,
  refreshToken,
  registerUser,
  verifyOtp,
  verifyUser,
} from "../controllers/auth.controller.js";
import { isAuth } from "../middlewares/isAuth.middleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/verify/:token", verifyUser);
router.post("/login", loginUser);
router.post("/verify-otp", verifyOtp);
router.get("/me", isAuth, MyProfile);
router.post("/refresh", refreshToken);
router.post("/logout", isAuth, logoutUser);

export default router;
