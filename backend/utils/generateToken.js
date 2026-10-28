const jwt = require('jsonwebtoken');

const generateToken = (userId, claims = {}) => {
  return jwt.sign({ id: userId, ...claims }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

module.exports = generateToken;
