const admin = require("../../config/firebase");

// ===============================
// Send a Report
// ===============================
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
    receiverRole,
    description,
    additionalInfo,
  } = req.body;

  const uid = req.user?.uid;
  const ownerEmail = req.user?.email;

  if (
    !owner ||
    !phone ||
    !date ||
    !time ||
    !location ||
    !plate ||
    !brand ||
    !toEmail ||
    !receiverRole
  ) {
    return res.status(400).json({ error: "All required fields are mandatory." });
  }

  if (!uid || !ownerEmail) {
    return res
      .status(401)
      .json({ error: "Unauthorized. User details missing." });
  }

  try {
    const newReport = {
      owner,
      ownerEmail,
      senderUid: uid,
      phone,
      date,
      time,
      location,
      plate,
      brand,
      toEmail: toEmail.toLowerCase(),
      receiverRole,
      description: description || "",
      additionalInfo: additionalInfo || "",
      status: "unread", 
      archived: false,  
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await admin.firestore().collection("reports").add(newReport);

    return res.status(201).json({ id: docRef.id, ...newReport });
  } catch (error) {
    console.error("🔥 Error sending report:", error.message);
    return res.status(500).json({ error: "Failed to send report" });
  }
};

// ===============================
// Get Reports Sent by Logged-in User
// ===============================
exports.getSentReports = async (req, res) => {
  try {
    const ownerEmail = req.user?.email;

    if (!ownerEmail) {
      return res.status(401).json({ error: "Unauthorized. User email missing." });
    }

    const snapshot = await admin
      .firestore()
      .collection("reports")
      .where("ownerEmail", "==", ownerEmail)
      .orderBy("timestamp", "desc")
      .get();

    const reports = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        owner: data.owner || "Unknown",
        plate: data.plate || "N/A",
        brand: data.brand || "N/A",
        status: data.status || "unread",
        timestamp: data.timestamp || null,
      };
    });

    return res.status(200).json({ reports });
  } catch (error) {
    console.error("🔥 Error fetching sent reports:", error);
    return res.status(500).json({ error: "Failed to fetch sent reports" });
  }
};

// ===============================
// Police: Get Unread Reports
// ===============================
exports.getUnreadReports = async (req, res) => {
  try {
    const userEmail = req.user?.email?.toLowerCase();
    if (!userEmail) {
      return res.status(401).json({ error: "Unauthorized. No user email." });
    }

    const snapshot = await admin
      .firestore()
      .collection("reports")
      .where("toEmail", "==", userEmail) // only for this station
      .where("status", "==", "unread")   // only unread
      .orderBy("timestamp", "desc")
      .get();

    const reports = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({ reports });
  } catch (error) {
    console.error("🔥 Error fetching unread reports:", error.message);
    return res.status(500).json({ error: "Failed to fetch unread reports" });
  }
};

// ===============================
// Police: Accept a Report (Unread → Pending)
// ===============================
exports.acceptReport = async (req, res) => {
  const { reportId } = req.params;

  if (!reportId) {
    return res.status(400).json({ error: "Report ID is required" });
  }

  try {
    const reportRef = admin.firestore().collection("reports").doc(reportId);
    const reportSnap = await reportRef.get();

    if (!reportSnap.exists) {
      return res.status(404).json({ error: "Report not found" });
    }

    await reportRef.update({
      status: "pending",
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: "Report accepted successfully" });
  } catch (error) {
    console.error("🔥 Error accepting report:", error.message);
    return res.status(500).json({ error: "Failed to accept report" });
  }
};

// ===============================
// Police: Update Report Status 
// ===============================
exports.updateReportStatus = async (req, res) => {
  const { reportId } = req.params;
  const { status } = req.body; 

  if (!reportId || !status) {
    return res.status(400).json({ error: "Report ID and status are required" });
  }

  try {
    const reportRef = admin.firestore().collection("reports").doc(reportId);
    const reportSnap = await reportRef.get();

    if (!reportSnap.exists) {
      return res.status(404).json({ error: "Report not found" });
    }

    await reportRef.update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: `Report status updated to ${status}` });
  } catch (error) {
    console.error("🔥 Error updating report status:", error.message);
    return res.status(500).json({ error: "Failed to update report status" });
  }
};

// ===============================
// Police: Archive a Report
// ===============================
exports.archiveReport = async (req, res) => {
  const { reportId } = req.params;

  if (!reportId) {
    return res.status(400).json({ error: "Report ID is required" });
  }

  try {
    const reportRef = admin.firestore().collection("reports").doc(reportId);
    const reportSnap = await reportRef.get();

    if (!reportSnap.exists) {
      return res.status(404).json({ error: "Report not found" });
    }

    await reportRef.update({
      archived: true,
      archivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: "Report archived successfully" });
  } catch (error) {
    console.error("🔥 Error archiving report:", error.message);
    return res.status(500).json({ error: "Failed to archive report" });
  }
};