// index.js — MotoGuard backend (Express + Firebase + MQTT)
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const admin = require("./config/firebase"); // Firebase Admin SDK
const mqtt = require("mqtt");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ==========================
// ⚙️ Configuration
// ==========================
const SYSTEM_AUTO_ON = (process.env.SYSTEM_AUTO_ON ?? "false").toLowerCase() === "true";
const GPS_SECRET = process.env.GPS_SECRET ?? null;

const DISTANCE_THRESHOLD = 15; // meters
const GPS_NOISE_THRESHOLD = 5; // meters
const HOME_READINGS_REQUIRED = 3;
const REPORT_COOLDOWN_MS = 60 * 1000;

const MQTT_BROKER = process.env.MQTT_BROKER || "mqtts://cee1784455524214820f3387732533d6.s1.eu.hivemq.cloud:8883";
const MQTT_USER = process.env.MQTT_USER || "Kazuki";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "Nazuna12";

// ==========================
// ✅ Runtime state
// ==========================
let SYSTEM_ACTIVE = SYSTEM_AUTO_ON;
let latestArduinoData = { error: "No data yet" };
let systemLogs = [];
let notificationLogs = [];
let homeLocation = null;
let initialReadings = [];
let policeStations = [];
let emergencyActive = false;
const lastReports = {}; // per-station cooldown

// ==========================
// 🚓 Load police stations
// ==========================
async function loadPoliceStations() {
  try {
    const snapshot = await admin.firestore().collection("police_stations").get();
    policeStations = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        lat: doc.data().position?.latitude ?? null,
        lng: doc.data().position?.longitude ?? null
      }))
      .filter(s => s.lat !== null && s.lng !== null);

    console.log(`🚓 Loaded ${policeStations.length} police stations`);
  } catch (err) {
    console.error("❌ Failed to load police stations:", err.message);
  }
}
loadPoliceStations();

// ==========================
// 🔧 Kalman Filter 1D
// ==========================
class KalmanFilter1D {
  constructor(R = 0.00001, Q = 0.0001) { this.R = R; this.Q = Q; this.x = null; this.P = 1; }
  filter(z) {
    if (this.x === null) { this.x = z; return z; }
    const x_pred = this.x;
    const P_pred = this.P + this.R;
    const K = P_pred / (P_pred + this.Q);
    this.x = x_pred + K * (z - x_pred);
    this.P = (1 - K) * P_pred;
    return this.x;
  }
}
const kalmanLat = new KalmanFilter1D();
const kalmanLng = new KalmanFilter1D();

// ==========================
// 📏 Utility functions
// ==========================
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getNearestStation(lat, lng, stations, maxDistance = 100) {
  let nearest = null;
  let minDist = Infinity;
  for (const s of stations) {
    const d = getDistance(lat, lng, s.lat, s.lng);
    if (d < minDist) { minDist = d; nearest = { ...s, distance: d }; }
  }
  return nearest && nearest.distance <= maxDistance ? nearest : null;
}

// ==========================
// 🛠 Core GPS handler
// ==========================
async function handleData(data, source = "gsm") {
  if (typeof data.lat === "undefined" || typeof data.lng === "undefined") return;

  // SYSTEM inactive
  if (!SYSTEM_ACTIVE) {
    latestArduinoData = { ...data, system: "inactive" };
    console.log("⛔ SYSTEM INACTIVE — GPS logged but no detection.");
    return;
  }

  // Home calibration
  if (!homeLocation) {
    initialReadings.push({ lat: data.lat, lng: data.lng });
    console.log(`🏠 Home setup progress: ${initialReadings.length}/${HOME_READINGS_REQUIRED}`);
    if (initialReadings.length >= HOME_READINGS_REQUIRED) {
      homeLocation = {
        lat: initialReadings.reduce((sum, r) => sum + r.lat, 0) / initialReadings.length,
        lng: initialReadings.reduce((sum, r) => sum + r.lng, 0) / initialReadings.length
      };
      kalmanLat.x = null; kalmanLng.x = null;
      console.log("✅ Home location established:", homeLocation);
    } else {
      latestArduinoData = { ...data, system: "calibrating" };
      return;
    }
  }

  // Smooth coordinates
  const lat = kalmanLat.filter(data.lat);
  const lng = kalmanLng.filter(data.lng);
  const distanceFromHome = getDistance(homeLocation.lat, homeLocation.lng, lat, lng);
  const moved = distanceFromHome > GPS_NOISE_THRESHOLD;

  latestArduinoData = { lat, lng, motion: !!data.motion, timestamp: data.timestamp ?? Date.now(), distance: distanceFromHome, moved, source };

  if (distanceFromHome < 11) {
    console.log(`✅ Safe movement (${distanceFromHome.toFixed(2)}m)`);
    emergencyActive = false;
    try { await admin.database().ref("device1/history").push({ ...latestArduinoData, status: "normal", createdAt: admin.database.ServerValue.TIMESTAMP }); } catch {}
    return;
  }

  const nearest = getNearestStation(lat, lng, policeStations, 100);

  if (distanceFromHome >= 11 && distanceFromHome < DISTANCE_THRESHOLD) {
    console.log(`⚠️ Warning — ${distanceFromHome.toFixed(2)}m from home!`);
    const warningData = {
      lat, lng, distance: distanceFromHome, type: "warning", message: "Warning Alert",
      station_id: nearest?.id ?? null, station_name: nearest?.name ?? nearest?.stationName ?? null,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    try { await admin.firestore().collection("notifications").add(warningData); } catch {}
    systemLogs.push({ message: "Warning Alert", timestamp: new Date().toISOString(), source });
    try { await admin.database().ref("device1/history").push({ ...latestArduinoData, status: "warning", createdAt: admin.database.ServerValue.TIMESTAMP }); } catch {}
    return;
  }

  if (!nearest) { console.log("🚨 No nearby station within 100m"); return; }

  // Emergency reporting with cooldown
  const now = Date.now();
  if (lastReports[nearest.id] && now - lastReports[nearest.id] < REPORT_COOLDOWN_MS) return;
  lastReports[nearest.id] = now;

  emergencyActive = true;
  const autoReport = {
    station_id: nearest.id,
    station_name: nearest.name ?? nearest.stationName ?? "Unknown",
    lat, lng, distance: nearest.distance,
    contact_number: nearest.contact_number ?? nearest.contactNumber ?? null,
    source, status: "emergency",
    message: "Vehicle moved beyond safety threshold — possible theft detected",
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  };

  try { await admin.firestore().collection("auto_reports").add(autoReport); } catch {}
  systemLogs.push({ message: "Emergency reported", timestamp: new Date().toISOString(), source });
  try { await admin.database().ref("device1/history").push({ ...latestArduinoData, status: "emergency", createdAt: admin.database.ServerValue.TIMESTAMP }); } catch {}
}

// ==========================
// 🌐 HTTP endpoints
// ==========================
app.post("/api/gps", async (req, res) => {
  try {
    if (GPS_SECRET && req.header("x-gps-secret") !== GPS_SECRET)
      return res.status(401).json({ error: "Unauthorized" });

    const { lat, lng, motion, timestamp } = req.body;
    if (typeof lat === "undefined" || typeof lng === "undefined")
      return res.status(400).json({ error: "lat and lng required" });

    await handleData({ lat: Number(lat), lng: Number(lng), motion: !!motion, timestamp: timestamp ?? Date.now() }, "gsm");
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

app.post("/api/logs", (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Log message required" });
  systemLogs.push({ message, timestamp: new Date().toISOString(), source: "arduino" });
  if (systemLogs.length > 200) systemLogs.shift();
  console.log("📥 Arduino Log:", message);
  res.json({ status: "ok" });
});

app.get("/api/logs", (req, res) => res.json(systemLogs.slice(-50)));
app.get("/api/notifications", (req, res) => res.json(notificationLogs.slice(-50)));
app.get("/api/system/status", (req, res) => res.json({ active: SYSTEM_ACTIVE, homeLocation, latestArduinoData }));
app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// ==========================
// 📡 MQTT integration
// ==========================
const mqttClient = mqtt.connect(MQTT_BROKER, { username: MQTT_USER, password: MQTT_PASSWORD });

mqttClient.on("connect", () => {
  console.log("✅ Connected to MQTT broker");
  mqttClient.subscribe("esp32_+/gps", err => { if (err) console.error("❌ Subscribe GPS failed:", err); });
  mqttClient.subscribe("esp32_+/logs", err => { if (err) console.error("❌ Subscribe LOG failed:", err); });
});

mqttClient.on("message", async (topic, msgBuffer) => {
  const rawMsg = msgBuffer.toString();
  console.log(`📨 Raw MQTT message on ${topic}: ${rawMsg}`);

  try {
    const payload = JSON.parse(rawMsg);

    if (topic.endsWith("/gps")) {
      await handleData({
        lat: Number(payload.lat),
        lng: Number(payload.lng),
        motion: !!payload.motion,
        timestamp: payload.timestamp ?? Date.now()
      }, "mqtt");
    }

    if (topic.endsWith("/logs")) {
      const log = { message: payload.message ?? rawMsg, timestamp: new Date().toISOString(), source: "mqtt" };
      systemLogs.push(log);
      if (systemLogs.length > 200) systemLogs.shift();
      console.log("📥 MQTT Log:", log.message);
    }
  } catch (err) {
    console.error("❌ MQTT JSON parse error:", err, rawMsg);
  }
});

// ==========================
// 🚀 Start server
// ==========================
const PORT = process.env.PORT ?? 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
