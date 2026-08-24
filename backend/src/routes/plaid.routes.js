const express = require("express");
const { body, param } = require("express-validator");

const {
  createLinkToken,
  exchangePublicToken,
  sync,
  listItems,
  removeItem,
} = require("../controllers/plaid.controller");
const { handleValidation } = require("../middleware/validate");
const { requireAuth } = require("../middleware/requireAuth");
const { cacheResponse } = require("../middleware/cache");

const router = express.Router();

router.use(requireAuth);

router.post("/link-token", createLinkToken);

router.post(
  "/exchange-token",
  [body("publicToken").notEmpty().withMessage("publicToken is required")],
  handleValidation,
  exchangePublicToken
);

router.post("/sync", sync);

router.get("/items", cacheResponse(), listItems);

router.delete("/items/:id", [param("id").isInt().withMessage("Invalid item id")], handleValidation, removeItem);

module.exports = router;
