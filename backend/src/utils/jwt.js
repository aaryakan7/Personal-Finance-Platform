const jwt = require("jsonwebtoken");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Add it to backend/.env.");
}

const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * Issues a signed JWT for a given user.
 * @param {{ id: number }} user
 * @returns {string} the JWT
 */
function signToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: EXPIRES_IN });
}

/**
 * Verifies a JWT and returns its decoded payload, or throws if it's invalid/expired.
 * @param {string} token
 */
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
