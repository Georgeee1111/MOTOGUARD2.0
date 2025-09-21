const admin = require("../../config/firebase");

exports.sendReport = async (req, res) => {
  const {
    owner,
    phone,
    date,
    time,
    location,
    plate,
    brand,
    toEmail,      
    description,
    additionalInfo,
  } = req.body;

  const ownerEmail = req.user?.email;

  if (
    !owner ||
    !phone ||
    !date ||
    !time ||
    !location ||
    !plate ||
    !brand ||
    !toEmail
  ) {
    return res.status(400).json({ error: "All required fields are mandatory." });
  }

  if (!ownerEmail) {
    return res.status(401).json({ error: "Unauthorized. User email missing." });
  }

  try {
    const newReport = {
      owner,
      ownerEmail, 
      phone,
      date,
      time,
      location,
      plate,
      brand,
      toEmail,
      description: description || "",
      additionalInfo: additionalInfo || "",
      status: "unread",
      timestamp: new Date(),
    };

    const docRef = await admin.firestore().collection("reports").add(newReport);

    return res.status(201).json({ id: docRef.id, ...newReport });
  } catch (error) {
    console.error("Error sending report:", error);
    return res.status(500).json({ error: "Failed to send report", details: error.message });
  }
};

exports.getSentReports = async (req, res) => {
  try {
    const ownerEmail = req.user?.email;

    if (!ownerEmail) {
      return res.status(401).json({ error: "Unauthorized. User email missing." });
    }

    const snapshot = await admin.firestore()
      .collection("reports")
      .where("ownerEmail", "==", ownerEmail)
      .orderBy("timestamp", "desc")
      .get();

    const reports = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json(reports);
  } catch (error) {
    console.error("Error fetching sent reports:", error);
    return res.status(500).json({ error: "Failed to fetch sent reports", details: error.message });
  }
};
