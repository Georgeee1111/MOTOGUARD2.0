const express = require("express");
const router = express.Router();

const { registerUser } = require("../controllers/auth/userController");
const { registerStation } = require("../controllers/auth/stationController");
const { getEmailByUsername, getUserProfile } = require("../controllers/auth/helperController");

const authenticateFirebaseToken = require("../middlewares/authMiddleware");
const authorizeRole = require("../middlewares/authorizeRole");

router.post("/register", registerUser);
router.post("/register-station", registerStation);
router.post("/get-email", getEmailByUsername);

router.get(
  "/profile/:uid",
  authenticateFirebaseToken,
  authorizeRole(["owner", "police"]),
  getUserProfile
);

module.exports = router;
