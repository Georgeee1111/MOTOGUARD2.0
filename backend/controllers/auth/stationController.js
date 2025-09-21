const admin = require("../../config/firebase");

exports.registerStation = async (req, res) => {
  const {
    username,
    email,
    password,
    stationName,
    stationNumber,
    address,
    contactNumber,
  } = req.body;

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
      displayName: stationName,
    });

    const uid = userRecord.uid;

    await admin.firestore().collection("users").doc(uid).set({
      uid,
      username,
      email,
      role: "police",
      stationName,
      address,
      contactNumber,
      ...(stationNumber && { stationNumber }),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ message: "Station registered", uid });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};
