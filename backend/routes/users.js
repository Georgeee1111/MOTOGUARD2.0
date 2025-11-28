const express = require("express");
const router = express.Router();

const { registerUser, updateUserProfile } = require("../controllers/auth/userController");
const { registerStation, updateStationProfile } = require("../controllers/auth/stationController");
const { getEmailByUsername, getUserProfile, getUserByContactNumber } = require("../controllers/auth/helperController");

const authenticateFirebaseToken = require("../middlewares/authMiddleware");
const authorizeRole = require("../middlewares/authorizeRole");

// ------------------------
// 🔹 Auth & Registration
// ------------------------
router.post("/register", registerUser);
router.post("/register-station", registerStation);
router.post("/get-email", getEmailByUsername);

// ------------------------
// 🔹 Profile Routes
// ------------------------
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

// ------------------------
// 🔹 Lookup user by contact number
// ------------------------
// Example request: GET /api/users/by-contact?contactNumber=09123456789
router.get(
  "/by-contact",
  authenticateFirebaseToken,
  authorizeRole(["owner", "police"]), // adjust roles if needed
  getUserByContactNumber
);

module.exports = router;
