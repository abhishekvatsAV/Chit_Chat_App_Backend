const { SignJWT } = require("jose");

const generateToken = async (id) => {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return await new SignJWT({ id: id.toString() })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret);
};

module.exports = generateToken;