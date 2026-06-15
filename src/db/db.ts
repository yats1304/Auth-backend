import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL as string, {
      dbName: "Auth",
    });
    console.log("Successfully connected to DB✅");
  } catch (error) {
    console.log("Failed to connect to DB❌");
  }
};

export default connectDB;
