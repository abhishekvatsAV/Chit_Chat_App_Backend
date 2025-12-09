const { jwtVerify } = require("jose");
const User = require("../models/userModel");
const asyncHandler = require("express-async-handler");

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      //decodes token id
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);

      req.user = await User.findById(payload.id).select("-password");

      next();
    } catch (error) {
      console.log("error middleware auth : ", error)
      // res.status(401).json({error});
      throw new Error("Not authorized, token failed");
    }
  }

  if (!token) {
    console.log("error middleware auth : ", error)
    res.status(401);
    throw new Error("Not authorized, no token");
  }
});

module.exports = { protect };
