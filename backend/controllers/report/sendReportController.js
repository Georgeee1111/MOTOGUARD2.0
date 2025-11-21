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
    toContactNumber, // receiver
    receiverRole,
    description,
    additionalInfo,
  } = req.body;

  const uid = req.user?.uid;

  if (
    !owner ||
    !phone ||
    !date ||
    !time ||
    !location ||
    !plate ||
    !brand ||
    !toContactNumber ||
    !receiverRole
  ) {
    return res
      .status(400)
      .json({ error: "All required fields are mandatory." });
  }

  if (!uid) {
    return res.status(401).json({
      error: "Unauthorized. User not authenticated.",
    });
  }

  try {
    const newReport = {
      owner,
      senderUid: uid, // Use UID instead of contactNumber
      phone,
      date,
      time,
      location,
      plate,
      brand,
      toContactNumber,
      receiverRole,
      description: description || "",
      additionalInfo: additionalInfo || "",
      status: "unread",
      archived: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await admin
      .firestore()
      .collection("reports")
      .add(newReport);

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
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({
        error: "Unauthorized. User not authenticated.",
      });
    }

    const snapshot = await admin
      .firestore()
      .collection("reports")
      .where("senderUid", "==", uid) // Query by UID
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
    const uid = req.user?.uid;

    if (!uid) {
      return res
        .status(401)
        .json({ error: "Unauthorized. User not authenticated." });
    }

    const snapshot = await admin
      .firestore()
      .collection("reports")
      .where("toContactNumber", "==", uid) // Optional: if receiver is UID
      .where("status", "==", "unread")
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

    return res
      .status(200)
      .json({ message: "Report accepted successfully" });
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
    return res.status(400).json({
      error: "Report ID and status are required",
    });
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

    return res
      .status(200)
      .json({ message: `Report status updated to ${status}` });
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

    return res
      .status(200)
      .json({ message: "Report archived successfully" });
  } catch (error) {
    console.error("🔥 Error archiving report:", error.message);
    return res.status(500).json({ error: "Failed to archive report" });
  }
};
