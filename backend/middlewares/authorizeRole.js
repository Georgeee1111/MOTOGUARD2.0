const admin = require("../config/firebase");

const authorizeRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const uid = req.user.uid;

      const userDoc = await admin.firestore().collection("users").doc(uid).get();

      if (!userDoc.exists) {
        return res.status(404).json({ error: "User not found" });
      }

      const userData = userDoc.data();

      if (!allowedRoles.includes(userData.role)) {
        return res.status(403).json({ error: "Forbidden: insufficient permissions" });
      }

      req.user = { ...req.user, ...userData };

      next();
    } catch (error) {
      return res.status(500).json({ error: "Server error" });
    }
  };
};

module.exports = authorizeRole;
