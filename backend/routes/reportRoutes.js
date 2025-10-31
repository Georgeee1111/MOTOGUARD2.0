const express = require("express");
const router = express.Router();

const authenticateFirebaseToken = require("../middlewares/authMiddleware");
const {
  sendReport,
  getSentReports,
  getUnreadReports,
  acceptReport,
  updateReportStatus,
  archiveReport, // ✅ include archive controller
} = require("../controllers/report/sendReportController");
const { getReceivedReports } = require("../controllers/report/receiveReportController");

const admin = require("../config/firebase");
const db = admin.firestore();

// ======================
// Send a report
// ======================
router.post("/send", authenticateFirebaseToken, sendReport);

// ======================
// Get all sent reports (by logged-in user/owner)
// ======================
router.get("/sent", authenticateFirebaseToken, getSentReports);

// ======================
// Get all received reports (by logged-in station)
// ======================
router.get("/received", authenticateFirebaseToken, getReceivedReports);

// ======================
// Get unread reports for the logged-in police station
// ======================
router.get("/unread", authenticateFirebaseToken, getUnreadReports);

// ======================
// Accept a report (Unread → Pending)
// ======================
router.patch("/:reportId/accept", authenticateFirebaseToken, acceptReport);

// ======================
// Update report status (Pending → On Progress → Resolved)
// ======================
router.patch("/:reportId/status", authenticateFirebaseToken, updateReportStatus);

// ======================
// Archive a report (set archived: true)
// ======================
router.patch("/:reportId/archive", authenticateFirebaseToken, archiveReport);

// ======================
// Get reports by status (only for logged-in station)
// Example: GET /api/reports/status/pending
// ======================
router.get("/status/:status", authenticateFirebaseToken, async (req, res) => {
  const { status } = req.params;
  const userEmail = req.user?.email?.toLowerCase();

  if (!userEmail) {
    return res.status(401).json({ error: "Unauthorized. No user email found." });
  }

  try {
    const snapshot = await db
      .collection("reports")
      .where("toEmail", "==", userEmail)
      .where("status", "==", status)
      .where("archived", "==", false) // only non-archived reports
      .get();

    const reports = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ reports });
  } catch (error) {
    console.error("Error fetching reports by status:", error);
    res.status(500).json({ error: "Failed to fetch reports by status" });
  }
});

// ======================
// Get archived reports (only for logged-in station)
// Example: GET /api/reports/archived
// ======================
router.get("/archived", authenticateFirebaseToken, async (req, res) => {
  const userEmail = req.user?.email?.toLowerCase();

  if (!userEmail) {
    return res.status(401).json({ error: "Unauthorized. No user email found." });
  }

  try {
    const snapshot = await db
      .collection("reports")
      .where("toEmail", "==", userEmail)
      .where("archived", "==", true)
      .get(); // removed orderBy to avoid Firestore index issues

    const reports = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ reports });
  } catch (error) {
    console.error("Error fetching archived reports:", error);
    res.status(500).json({ error: "Failed to fetch archived reports" });
  }
});


// ======================
// Get report by ID
// ======================
router.get("/:id", authenticateFirebaseToken, async (req, res) => {
  const { id } = req.params;

  try {
    const docRef = db.collection("reports").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

module.exports = router;
