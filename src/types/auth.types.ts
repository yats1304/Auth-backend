import { Document } from "mongoose";

export interface IAuth extends Document {
  name: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface ILoginInput {
  email: string;
  password: string;
}
