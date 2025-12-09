const asyncHandler = require("express-async-handler");
const generateToken = require("../config/genrateToken");
const User = require("../models/userModel");

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, pic } = req.body;
  
  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please Enter All the Fields");
  }

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      res.status(400);
      throw new Error("User with this email already exists!");
    }

    const user = await User.create({
      name,
      email,
      password,
      pic,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        pic: user.pic,
        token: await generateToken(user._id),
      });
    } else {
      res.status(400);
      throw new Error("Failed to Create a User!");
    }
  } catch (error) {
    // If it's a validation error from mongoose, return a cleaner message
    if (error.name === 'ValidationError') {
      res.status(400);
      throw new Error(Object.values(error.errors).map(e => e.message).join(', '));
    }
    throw error;
  }
});

const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  // console.log("auth", email, password);

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      pic: user.pic,
      token: await generateToken(user._id),
    });
  } else {
    // console.log("Invalid UserName or Password");
    res.status(401).json({ message: "Invalid UserName or Password" });
  }
});

// /api/user?search=luffy      ? query
const allUsers = asyncHandler(async (req, res) => {
  const keyword = req.query.search
    ? {
        $or: [
          { name: { $regex: req.query.search, $options: "i" } },
          { email: { $regex: req.query.search, $options: "i" } },
        ],
      }
    : {};

  const users = await User.find(keyword).find({
    _id: { $ne: req.user._id },
  });

  res.send(users);
});

module.exports = { registerUser, authUser, allUsers };
