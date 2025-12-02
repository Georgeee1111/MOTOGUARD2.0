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

// Update User Location
exports.updateUserLocation = async (req, res) => {
  try {
    const { uid } = req.params;
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ message: "Latitude and longitude required" });
    }

    // Store/update in Firestore
    await admin.firestore().collection("userLocations").doc(uid).set({
      lat,
      lng,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ message: "Location updated successfully" });
  } catch (error) {
    console.error("Error updating user location:", error);
    res.status(500).json({ message: "Failed to update location" });
  }
};

// Get Device + Active Owner Info
exports.getDeviceOwnerInfo = async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Fetch device from RTDB
    const deviceSnapshot = await admin.database().ref(deviceId).get();
    const deviceData = deviceSnapshot.val();

    if (!deviceData) return res.status(404).json({ message: "Device not found" });

    // Fetch owner from Firestore using ownerUid
    let ownerData = null;
    if (deviceData.activeOwnerId?.ownerUid) {
      const ownerDoc = await admin.firestore()
        .collection("users")
        .doc(deviceData.activeOwnerId.ownerUid)
        .get();
      if (ownerDoc.exists) ownerData = ownerDoc.data();
    }

    res.json({ device: deviceData, owner: ownerData });
  } catch (err) {
    console.error("Error fetching device owner info:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Register/update Expo push token
exports.registerPushToken = async (req, res) => {
  try {
    const { uid, expoPushToken } = req.body;

    if (!uid || !expoPushToken) {
      return res.status(400).json({ message: "uid and expoPushToken are required" });
    }

    const userRef = admin.firestore().collection("users").doc(uid);

    // Add or update the push token (store as array to support multiple devices)
    await userRef.set(
      {
        expoPushTokens: admin.firestore.FieldValue.arrayUnion(expoPushToken),
      },
      { merge: true }
    );

    return res.status(200).json({ message: "Push token registered successfully" });
  } catch (err) {
    console.error("Error registering push token:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

