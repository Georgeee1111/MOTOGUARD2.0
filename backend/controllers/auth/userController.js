const admin = require("../../config/firebase");

// ✅ Register User (no change)
exports.registerUser = async (req, res) => {
  const {
    username,
    email,
    password,
    fullName,
    vehicleInfo,
    address,
    mobileNumber,
    gender,
  } = req.body;

  try {
    // Check if username already exists
    const usernameQuery = await admin
      .firestore()
      .collection("users")
      .where("username", "==", username)
      .get();

    if (!usernameQuery.empty) {
      return res.status(400).json({ error: "Username already taken" });
    }

    // Create Firebase Auth account
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: fullName,
    });

    const uid = userRecord.uid;

    // Store in Firestore
    await admin.firestore().collection("users").doc(uid).set({
      uid,
      username,
      email,
      fullName,
      vehicleInfo,
      address: address || "",
      mobileNumber: mobileNumber || "",
      gender: gender || "",
      role: "owner",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ message: "User registered", uid });
  } catch (error) {
    console.error("❌ Register error:", error);
    return res.status(400).json({ error: error.message });
  }
};

// ✅ Update owner profile (FULL UPDATE VERSION)
exports.updateUserProfile = async (req, res) => {
  const { uid } = req.params;
  const {
    username,
    email,
    fullName,
    vehicleInfo,
    address,
    mobileNumber,
    gender,
    password, // ✅ include this
  } = req.body;

  try {
    const userRef = admin.firestore().collection("users").doc(uid);
    const doc = await userRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    // ✅ Update Firestore
    await userRef.update({
      ...(username && { username }),
      ...(email && { email }),
      ...(fullName && { fullName }),
      ...(address && { address }),
      ...(mobileNumber && { mobileNumber }),
      ...(gender && { gender }),
      ...(vehicleInfo && { vehicleInfo }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ✅ Update Firebase Auth info (email, displayName, password)
    const authUpdate = {};
    if (email) authUpdate.email = email;
    if (fullName) authUpdate.displayName = fullName;
    if (password) authUpdate.password = password; // ✅ update password
    if (Object.keys(authUpdate).length > 0) {
      await admin.auth().updateUser(uid, authUpdate);
    }

    return res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("❌ Update error:", error);
    return res.status(400).json({ error: error.message });
  }
};
