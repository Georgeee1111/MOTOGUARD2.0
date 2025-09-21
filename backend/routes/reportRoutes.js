const express = require("express");
const router = express.Router();

const authenticateFirebaseToken = require("../middlewares/authMiddleware");
const {
  sendReport,
  getSentReports,
} = require("../controllers/report/sendReportController");
const { getReceivedReports } = require("../controllers/report/receiveReportController");

const { db } = require("../config/firebase");

router.post("/send", authenticateFirebaseToken, sendReport);

router.get("/sent", authenticateFirebaseToken, getSentReports);

router.get("/received", authenticateFirebaseToken, getReceivedReports);

router.get('/:id', authenticateFirebaseToken, async (req, res) => {
  const { id } = req.params;
  console.log(`Fetching report with ID: ${id}`);

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
