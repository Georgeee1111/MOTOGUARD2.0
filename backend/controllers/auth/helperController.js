const admin = require("../../config/firebase");

exports.getEmailByUsername = async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  try {
    const userQuery = await admin.firestore()
      .collection("users")
      .where("username", "==", username)
      .limit(1)
      .get();

    if (userQuery.empty) {
      return res.status(404).json({ error: "Username not found" });
    }

    const userData = userQuery.docs[0].data();

    return res.status(200).json({ email: userData.email });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.getUserProfile = async (req, res) => {
  const uid = req.params.uid || (req.user && req.user.uid);

  if (!uid) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    const doc = await admin.firestore().collection("users").doc(uid).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = doc.data();

    return res.status(200).json({
      uid: doc.id,
      ...userData,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ----------------------------
// 🔹 Check if a contact number belongs to a police user
// ----------------------------
exports.getUserByContactNumber = async (req, res) => {
  const { contactNumber } = req.query;

  if (!contactNumber) {
    return res.status(400).json({ error: "Contact number is required" });
  }

  try {
    const userQuery = await admin.firestore()
      .collection("users")
      .where("contactNumber", "==", contactNumber)
      .limit(1)
      .get();

    if (userQuery.empty) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userQuery.docs[0].data();
    return res.status(200).json({ id: userQuery.docs[0].id, ...userData });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
