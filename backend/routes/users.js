const express = require("express");
const router = express.Router();

const {
  registerUser,
  updateUserProfile,
  updateUserLocation,
  getDeviceOwnerInfo,
  registerPushToken, // ✅ added
} = require("../controllers/auth/userController");

const { registerStation, updateStationProfile } = require("../controllers/auth/stationController");
const { getEmailByUsername, getUserProfile } = require("../controllers/auth/helperController");

const authenticateFirebaseToken = require("../middlewares/authMiddleware");
const authorizeRole = require("../middlewares/authorizeRole");

// =====================
// Public routes
// =====================
router.post("/register", registerUser);
router.post("/register-station", registerStation);
router.post("/get-email", getEmailByUsername);

// =====================
// Protected routes
// =====================
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

// ✅ Update user location
router.post(
  "/update-location/:uid",
  authenticateFirebaseToken,
  authorizeRole(["owner"]),
  updateUserLocation
);

// ✅ Get device + owner info
router.get(
  "/device/:deviceId/owner",
  authenticateFirebaseToken,
  authorizeRole(["police"]),
  getDeviceOwnerInfo
);

// =====================
// Push notification token
// =====================
router.post(
  "/push-token",
  authenticateFirebaseToken,
  authorizeRole(["owner"]),
  registerPushToken
);

module.exports = router;
