import mongoose from "mongoose";
import { IAuth } from "../types/auth.types.js";

const schema = new mongoose.Schema<IAuth>(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export const User = mongoose.model<IAuth>("User", schema);
