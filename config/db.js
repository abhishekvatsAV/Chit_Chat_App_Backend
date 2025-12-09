const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.log("Error: MONGO_URI is not defined in environment variables");
      process.exit(1);
    }
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB connected successfully`);
  } catch (error) {
    console.log(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
