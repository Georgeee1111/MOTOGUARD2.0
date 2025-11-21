const admin = require("../../config/firebase");

exports.getReceivedReports = async (req, res) => {
  const { role } = req.query;
  const uid = req.user?.uid; 

  if (!uid) {
    return res.status(401).json({
      error: "Unauthorized. User not authenticated.",
    });
  }

  if (!role) {
    return res.status(400).json({
      error: "Missing role query parameter",
    });
  }

  try {
    const snapshot = await admin
      .firestore()
      .collection("reports")
      .where("receiverRole", "==", role)
      .where("toContactNumber", "==", uid) 
      .orderBy("timestamp", "desc")
      .get();

    const reports = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json(reports);
  } catch (error) {
    console.error("🔥 Error fetching received reports:", error.message);

    return res.status(500).json({
      error: "Failed to fetch reports",
      details: error.message,
    });
  }
};
