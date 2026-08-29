const { validationResult } = require("express-validator");

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "Invalid input", details: errors.array() });
  }
  next();
}

module.exports = { handleValidation };
