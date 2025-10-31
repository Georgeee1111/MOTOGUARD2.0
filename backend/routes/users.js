const express = require("express");
const router = express.Router();

const { registerUser, updateUserProfile } = require("../controllers/auth/userController");
const { registerStation, updateStationProfile } = require("../controllers/auth/stationController");
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

// ✅ PATCH routes for updating user info
router.patch(
  "/update-user/:uid",
  authenticateFirebaseToken,
  authorizeRole(["owner"]),
  updateUserProfile
);

router.patch(
  "/update-station/:uid",
  authenticateFirebaseToken,
  authorizeRole(["police"]),
  updateStationProfile
);

module.exports = router;
