const admin = require("../../config/firebase");

exports.getReceivedReports = async (req, res) => {
  const { role } = req.query;

  if (!role) {
    return res.status(400).json({ error: "Missing role query parameter" });
  }

  try {
    const snapshot = await admin
      .firestore()
      .collection("reports")
      .where("receiverRole", "==", role)
      .orderBy("timestamp", "desc")
      .get();

    const reports = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reports", details: error.message });
  }
};
