// index.js — MotoGuard backend (Express + Firebase + MQTT)
// Changes:
// - Accept optional `motion` field from device
// - Add /health endpoint
// - Optional SYSTEM_AUTO_ON env var to auto-activate system
// - MQTT integration for ESP32 devices
// - Keeps CORS, RTDB + Firestore writes, police station proximity, diagnostics

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const admin = require("./config/firebase"); // Firebase Admin SDK
const mqtt = require("mqtt");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// -------------------------
// ⚙️ Configuration
// -------------------------
const USE_ARDUINO = true;
const USE_MOCK_DATA = false;
const DISTANCE_THRESHOLD = 15;   // meters
const GPS_NOISE_THRESHOLD = 5;   // meters
const HOME_READINGS_REQUIRED = 3;
const MOCK_INTERVAL = 5000;      // ms
const REPORT_COOLDOWN_MS = 60 * 1000;
const GPS_SECRET = process.env.GPS_SECRET ?? null;
const SYSTEM_AUTO_ON = (process.env.SYSTEM_AUTO_ON ?? "false").toLowerCase() === "true";

// MQTT config
const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://broker.hivemq.com";
const MQTT_USER = process.env.MQTT_USER || "";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "";
const DEVICE_TOPIC_PREFIX = "esp32_"; // prefix for device topics

// -------------------------
// ✅ Runtime state
// -------------------------
let SYSTEM_ACTIVE = false;
let latestArduinoData = { error: "No data yet" };
let systemLogs = [];
let notificationLogs = [];
let homeLocation = null;
let initialReadings = [];
let policeStations = [];
let emergencyActive = false;
const lastReports = {}; // per-station cooldown

// -------------------------
// 🚓 Load Police Stations (Firestore)
// -------------------------
async function loadPoliceStations() {
  try {
    const snapshot = await admin.firestore().collection("police_stations").get();
    policeStations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      lat: doc.data().position?.latitude ?? null,
      lng: doc.data().position?.longitude ?? null,
    })).filter(s => s.lat !== null && s.lng !== null);
    console.log(`🚓 Loaded ${policeStations.length} police stations`);
  } catch (err) {
    console.error("❌ Failed to load police stations:", err.message);
  }
}
loadPoliceStations();

// -------------------------
// 🔧 Kalman Filter (1D)
// -------------------------
class KalmanFilter1D {
  constructor(R = 0.00001, Q = 0.0001) {
    this.R = R; this.Q = Q; this.x = null; this.P = 1;
  }
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

// -------------------------
// 📏 Haversine distance
// -------------------------
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// -------------------------
// 🧭 Nearest station
// -------------------------
function getNearestStation(motoLat, motoLng, stations, maxDistance = 100) {
  let nearest = null;
  let minDist = Infinity;
  for (const station of stations) {
    const d = getDistance(motoLat, motoLng, station.lat, station.lng);
    if (d < minDist) {
      minDist = d;
      nearest = { ...station, distance: d };
    }
  }
  if (nearest && nearest.distance <= maxDistance) return nearest;
  return null;
}

// -------------------------
// 🛠 Core handler: process GPS
// -------------------------
async function handleData(data, source = "gsm", isMock = false) {
  if (typeof data.lat === "undefined" || typeof data.lng === "undefined") return;

  if (!SYSTEM_ACTIVE) {
    latestArduinoData = { ...data, system: "inactive" };
    console.log("⛔ SYSTEM INACTIVE — GPS logged but no detection.");
    return;
  }

  if (!homeLocation) {
    initialReadings.push({ lat: data.lat, lng: data.lng });
    console.log(`🏠 Home setup progress: ${initialReadings.length}/${HOME_READINGS_REQUIRED}`);
    if (initialReadings.length >= HOME_READINGS_REQUIRED) {
      homeLocation = {
        lat: initialReadings.reduce((s, r) => s + r.lat, 0) / initialReadings.length,
        lng: initialReadings.reduce((s, r) => s + r.lng, 0) / initialReadings.length,
      };
      kalmanLat.x = null; kalmanLng.x = null;
      console.log("✅ Home location established:", homeLocation);
    } else {
      latestArduinoData = { lat: data.lat, lng: data.lng, motion: !!data.motion, timestamp: data.timestamp ?? Date.now(), system: "calibrating" };
      return;
    }
  }

  const smoothedLat = isMock ? data.lat : kalmanLat.filter(data.lat);
  const smoothedLng = isMock ? data.lng : kalmanLng.filter(data.lng);
  const distanceFromHome = getDistance(homeLocation.lat, homeLocation.lng, smoothedLat, smoothedLng);
  const moved = distanceFromHome > GPS_NOISE_THRESHOLD;

  latestArduinoData = { lat: smoothedLat, lng: smoothedLng, motion: !!data.motion, timestamp: data.timestamp ?? Date.now(), distance: distanceFromHome, moved, source };

  if (distanceFromHome < 11) {
    console.log(`✅ Safe movement (${distanceFromHome.toFixed(2)}m)`);
    try {
      await admin.database().ref("device1/history").push({ ...latestArduinoData, status: "normal", createdAt: admin.database.ServerValue.TIMESTAMP });
    } catch {}
    emergencyActive = false;
    return;
  }

  const nearestStation = getNearestStation(smoothedLat, smoothedLng, policeStations, 100);

  if (distanceFromHome >= 11 && distanceFromHome < DISTANCE_THRESHOLD) {
    console.log(`⚠️ Warning — ${distanceFromHome.toFixed(2)}m from home!`);
    const warningData = { lat: smoothedLat, lng: smoothedLng, distance: distanceFromHome, type: "warning", message: "Warning Alert", station_id: nearestStation?.id ?? null, station_name: nearestStation?.name ?? nearestStation?.stationName ?? null, timestamp: admin.firestore.FieldValue.serverTimestamp() };
    try { await admin.firestore().collection("notifications").add(warningData); } catch {}
    notificationLogs.push({ number: nearestStation?.contact_number ?? nearestStation?.contactNumber ?? "N/A", message: "Warning Alert", type: "warning", date: new Date().toLocaleString(), timestamp: new Date() });
    try { await admin.database().ref("device1/history").push({ ...latestArduinoData, status: "warning", createdAt: admin.database.ServerValue.TIMESTAMP }); } catch {}
    return;
  }

  if (!nearestStation) { console.log("🚨 No nearby station within 100m — cannot auto-report."); return; }

  const stationId = nearestStation.id;
  const now = Date.now();
  if (lastReports[stationId] && now - lastReports[stationId] < REPORT_COOLDOWN_MS) return;
  lastReports[stationId] = now;
  emergencyActive = true;

  const contactNumber = nearestStation.contact_number ?? nearestStation.contactNumber ?? null;
  const autoReport = { station_id: stationId, station_name: nearestStation.name ?? nearestStation.stationName ?? "Unknown", lat: smoothedLat, lng: smoothedLng, distance: nearestStation.distance, contact_number: contactNumber, source: isMock ? "mock" : "gsm", status: "emergency", message: "Vehicle moved beyond safety threshold — possible theft detected", timestamp: admin.firestore.FieldValue.serverTimestamp() };
  try { await admin.firestore().collection("auto_reports").add(autoReport); } catch {}
  const notification = { number: contactNumber ?? "N/A", message: "Emergency reported", type: "emergency", date: new Date().toLocaleString(), timestamp: new Date() };
  notificationLogs.push(notification);
  try { await admin.firestore().collection("notifications").add(notification); } catch {}
  try { await admin.database().ref("device1/history").push({ ...latestArduinoData, status: "emergency", createdAt: admin.database.ServerValue.TIMESTAMP }); } catch {}
}

// -------------------------
// 🌐 HTTP Endpoints
// -------------------------
app.post("/api/gps", async (req, res) => {
  try {
    if (GPS_SECRET) { const secret = req.header("x-gps-secret"); if (!secret || secret !== GPS_SECRET) return res.status(401).json({ error: "Unauthorized GPS post" }); }
    const { lat, lng, timestamp, motion } = req.body;
    if (typeof lat === "undefined" || typeof lng === "undefined") return res.status(400).json({ error: "lat and lng required" });
    await handleData({ lat: Number(lat), lng: Number(lng), timestamp: timestamp ?? Date.now(), motion: !!motion }, "gsm", false);
    return res.json({ ok: true });
  } catch (err) { console.error("❌ /api/gps error:", err); return res.status(500).json({ error: "server error" }); }
});

app.post("/api/logs", (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Log message required" });
  systemLogs.push({ message, timestamp: new Date().toISOString(), source: "arduino" });
  if (systemLogs.length > 200) systemLogs.shift();
  console.log("📥 Arduino Log:", message);
  return res.json({ status: "ok" });
});

app.get("/health", (req, res) => res.status(200).json({ ok: true, ts: Date.now() }));
app.get("/api/system/status", (req, res) => res.json({ active: SYSTEM_ACTIVE, homeLocation, latestArduinoData }));
app.get("/api/arduino", (req, res) => res.json(latestArduinoData));
app.get("/api/logs", (req, res) => res.json(systemLogs.slice(-50)));
app.get("/api/notifications", (req, res) => res.json(notificationLogs.slice(-50)));
app.get("/", (req, res) => res.send("✅ Backend running + Firebase RTDB + Firestore connected"));

app.post("/api/system/toggle", async (req, res) => {
  try {
    const { enabled } = req.body;
    const wasActive = SYSTEM_ACTIVE;
    SYSTEM_ACTIVE = !!enabled;
    console.log(`🔒 System is now ${SYSTEM_ACTIVE ? "ACTIVE ✅" : "INACTIVE ⛔"}`);
    if (SYSTEM_ACTIVE && !wasActive) { homeLocation = null; initialReadings = []; kalmanLat.x = null; kalmanLng.x = null; console.log("🏠 Home reset — recalibration needed"); }
    res.json({ message: `System is now ${SYSTEM_ACTIVE ? "ACTIVE ✅" : "INACTIVE ❌"}`, active: SYSTEM_ACTIVE });
  } catch (err) { console.error("❌ Toggle error:", err); res.status(500).json({ error: "server error" }); }
});

// -------------------------
// 🌐 Other routes
// -------------------------
const userRoutes = require("./routes/users");
const reportRoutes = require("./routes/reportRoutes");
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);

// -------------------------
// 📡 MQTT Integration
// -------------------------
const mqttClient = mqtt.connect(MQTT_BROKER, { username: MQTT_USER, password: MQTT_PASSWORD });
mqttClient.on("connect", () => {
  console.log("✅ Connected to MQTT broker");
  mqttClient.subscribe(`${DEVICE_TOPIC_PREFIX}+\/gps`);
  mqttClient.subscribe(`${DEVICE_TOPIC_PREFIX}+\/logs`);
});

mqttClient.on("message", async (topic, messageBuffer) => {
  const message = messageBuffer.toString();
  try {
    const payload = JSON.parse(message);
    if (topic.endsWith("/gps")) await handleData({ lat: Number(payload.lat), lng: Number(payload.lng), timestamp: payload.timestamp ?? Date.now(), motion: !!payload.motion }, "mqtt", false);
    if (topic.endsWith("/logs")) { systemLogs.push({ message: payload.message ?? message, timestamp: new Date().toISOString(), source: "mqtt" }); if (systemLogs.length > 200) systemLogs.shift(); console.log("📥 MQTT log:", payload.message ?? message); }
  } catch (err) { console.error("❌ MQTT handling failed:", err); }
});

// -------------------------
// 🚀 Start Server
// -------------------------
const PORT = process.env.PORT ?? 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  if (SYSTEM_AUTO_ON) { SYSTEM_ACTIVE = true; console.log("🔧 SYSTEM_AUTO_ON=true — system activated automatically at startup."); }
});
