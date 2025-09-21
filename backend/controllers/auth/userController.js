const admin = require("../../config/firebase");

exports.registerUser = async (req, res) => {
  const { username, email, password, fullName, vehicleInfo } = req.body;

  try {
    const usernameQuery = await admin.firestore()
      .collection("users")
      .where("username", "==", username)
      .get();

    if (!usernameQuery.empty) {
      return res.status(400).json({ error: "Username already taken" });
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: fullName,
    });

    const uid = userRecord.uid;

    await admin.firestore().collection("users").doc(uid).set({
      uid,
      username,
      email,
      fullName,
      vehicleInfo,
      role: "owner",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ message: "User registered", uid });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};
