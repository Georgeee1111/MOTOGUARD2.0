// ==========================
// index.js — MotoGuard Backend (Express + Firebase + MQTT)
// ==========================

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const admin = require("./config/firebase"); // Firebase Admin SDK
const mqtt = require("mqtt");
const { Expo } = require("expo-server-sdk");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const expo = new Expo();

// ==========================
// ⚙️ Configuration
// ==========================
const SYSTEM_AUTO_ON = (process.env.SYSTEM_AUTO_ON ?? "false").toLowerCase() === "true";
const GPS_SECRET = process.env.GPS_SECRET ?? null;

const DISTANCE_THRESHOLD = Number(process.env.DISTANCE_THRESHOLD ?? 15);
const GPS_NOISE_THRESHOLD = Number(process.env.GPS_NOISE_THRESHOLD ?? 5);
const HOME_READINGS_REQUIRED = Number(process.env.HOME_READINGS_REQUIRED ?? 3);
const REPORT_COOLDOWN_MS = Number(process.env.REPORT_COOLDOWN_MS ?? 60 * 1000);

const MQTT_BROKER = process.env.MQTT_BROKER || "mqtts://broker.hivemq.com:8883";
const MQTT_USER = process.env.MQTT_USER || "";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "";

const DEVICES = (process.env.DEVICES || "esp32_01").split(",").map(s => s.trim()).filter(Boolean);

// Mock / Arduino
const USE_ARDUINO = true;
const USE_MOCK_DATA = false;
const MOCK_INTERVAL = 5000;

// Max logs
const MAX_LOGS = Number(process.env.MAX_LOGS ?? 200);

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
let pushTokens = []; // <--- Token storage

// Mock control
let _mockIntervalId = null;
let _mockLoopRunning = false;

// ==========================
// 🔧 Logging
// ==========================
function enqueueLog(entry) {
  systemLogs.push(entry);
  if (systemLogs.length > MAX_LOGS) systemLogs.shift();
}

function logSystem(message, source = "system", extra = {}) {
  const msg = (typeof message === "object") ? message : String(message);
  const logEntry = {
    timestamp: new Date().toISOString(),
    source,
    message: msg,
    ...extra
  };
  enqueueLog(logEntry);
  console.log("📥 LOG:", JSON.stringify(logEntry, null, 2));
  return logEntry;
}

const logInfo = (m, s = "system", extra = {}) => logSystem(m, s, extra);
const logWarn = (m, s = "system", extra = {}) => logSystem(`WARN: ${m}`, s, extra);
const logError = (m, s = "system", extra = {}) => logSystem(`ERROR: ${m}`, s, extra);

// ==========================
// 🔄 Firestore police stations
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
    logInfo(`Loaded ${policeStations.length} police stations`, "firestore");
  } catch (err) {
    logError(`Failed to load police stations: ${err.message}`, "firestore");
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
// 📏 Utilities
// ==========================
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
// 🧭 Mock helpers
// ==========================
async function setMockHome() {
  if (policeStations.length === 0) return logWarn("No police stations — mock home not set");
  const base = policeStations[0];
  homeLocation = { lat: base.lat, lng: base.lng };
  initialReadings = [];
  kalmanLat.x = null; kalmanLng.x = null;
  logInfo("🏠 Mock home location set near " + (base.name || base.stationName));
}

function generateRandomPointNearHome(minDist = 1, maxDist = 30) {
  if (!homeLocation) return null;
  const distance = minDist + Math.random() * (maxDist - minDist);
  const angle = Math.random() * 2 * Math.PI;
  const R = 6371000;
  const δ = distance / R;
  const lat1 = (homeLocation.lat * Math.PI) / 180;
  const lng1 = (homeLocation.lng * Math.PI) / 180;

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(δ) + Math.cos(lat1) * Math.sin(δ) * Math.cos(angle));
  const lng2 = lng1 + Math.atan2(Math.sin(angle) * Math.sin(δ) * Math.cos(lat1), Math.cos(δ) - Math.sin(lat1) * Math.sin(lat2));

  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

async function startMockLoop() {
  if (_mockLoopRunning) return;
  _mockLoopRunning = true;
  logInfo("Starting mock GPS simulation");

  _mockIntervalId = setInterval(async () => {
    if (!SYSTEM_ACTIVE || !homeLocation) return;
    const point = generateRandomPointNearHome(1, 20);
    if (!point) return;
    await handleData({ lat: point.lat, lng: point.lng, timestamp: Date.now() }, "mock", true);
  }, MOCK_INTERVAL);
}

function stopMockLoop() {
  if (_mockIntervalId) clearInterval(_mockIntervalId);
  _mockIntervalId = null;
  _mockLoopRunning = false;
  logInfo("Mock loop stopped");
}

// ==========================
// 🔔 Push notifications
// ==========================
async function sendPushNotification(title, body, data = {}) {
  if (!pushTokens.length) return logWarn("No push tokens registered");
  const messages = pushTokens.filter(Expo.isExpoPushToken).map(token => ({ to: token, sound: "default", title, body, data }));
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      logInfo("Expo push sent", "expo", { tickets });
    } catch (err) {
      logError("Failed to send push: " + err.message, "expo");
    }
  }
}

// ==========================
// 🛠 Core GPS handler
// ==========================
async function handleData(data, source = "gsm", isMock = false) {
  if (typeof data.lat === "undefined" || typeof data.lng === "undefined") {
    logWarn("Received data without lat/lng - ignored", source, { data });
    return;
  }

  if (!SYSTEM_ACTIVE) {
    latestArduinoData = { ...data, system: "inactive" };
    logInfo("System inactive — GPS logged but ignored", "system");
    return;
  }

  // Home calibration
  if (!homeLocation) {
    initialReadings.push({ lat: data.lat, lng: data.lng });
    logInfo("Home calibration progress", "calibration", { progress: initialReadings.length });
    if (initialReadings.length >= HOME_READINGS_REQUIRED) {
      homeLocation = {
        lat: initialReadings.reduce((sum, r) => sum + r.lat, 0) / initialReadings.length,
        lng: initialReadings.reduce((sum, r) => sum + r.lng, 0) / initialReadings.length
      };
      kalmanLat.x = null; kalmanLng.x = null;
      logInfo("Home location established", "calibration", { homeLocation });
    } else {
      latestArduinoData = { ...data, system: "calibrating" };
      return;
    }
  }

  const lat = isMock ? data.lat : kalmanLat.filter(data.lat);
  const lng = isMock ? data.lng : kalmanLng.filter(data.lng);
  const distanceFromHome = getDistance(homeLocation.lat, homeLocation.lng, lat, lng);
  const moved = distanceFromHome > GPS_NOISE_THRESHOLD;

  latestArduinoData = { lat, lng, motion: !!data.motion, timestamp: data.timestamp ?? Date.now(), distance: distanceFromHome, moved, source };
  logInfo("Processed GPS", "gps", latestArduinoData);

  // Determine nearest station
  const nearest = getNearestStation(lat, lng, policeStations, 100);

  if (distanceFromHome < 11) {
    emergencyActive = false;
    await admin.database().ref("device1/history").push({ ...latestArduinoData, status: "normal", createdAt: admin.database.ServerValue.TIMESTAMP });
    return;
  }

  if (distanceFromHome >= 11 && distanceFromHome < DISTANCE_THRESHOLD) {
    const warningData = { lat, lng, distance: distanceFromHome, type: "warning", station_id: nearest?.id ?? null, timestamp: admin.firestore.FieldValue.serverTimestamp() };
    await admin.firestore().collection("notifications").add(warningData);
    notificationLogs.push({ type: "warning", message: "Warning Alert", date: new Date().toLocaleString(), number: nearest?.contact_number ?? "N/A" });
    await admin.database().ref("device1/history").push({ ...latestArduinoData, status: "warning", createdAt: admin.database.ServerValue.TIMESTAMP });
    return;
  }

  // Emergency
  const now = Date.now();
  if (nearest?.id && lastReports[nearest.id] && now - lastReports[nearest.id] < REPORT_COOLDOWN_MS) return;
  if (nearest?.id) lastReports[nearest.id] = now;

  emergencyActive = true;
  const autoReport = { station_id: nearest?.id ?? null, station_name: nearest?.name ?? nearest?.stationName ?? "Unknown", lat, lng, distance: distanceFromHome, source, status: "emergency", message: "Vehicle moved beyond safety threshold", timestamp: admin.firestore.FieldValue.serverTimestamp() };
  await admin.firestore().collection("auto_reports").add(autoReport);
  notificationLogs.push({ type: "emergency", message: "Emergency reported", date: new Date().toLocaleString(), lat, lng, distance: distanceFromHome });
  await admin.database().ref("device1/history").push({ ...latestArduinoData, status: "emergency", createdAt: admin.database.ServerValue.TIMESTAMP });

  // Send push
  await sendPushNotification("Emergency Alert", "Vehicle moved beyond safe distance!");
}

// ==========================
// 🌐 HTTP endpoints
// ==========================
app.post("/api/gps", async (req, res) => {
  try {
    if (GPS_SECRET && req.header("x-gps-secret") !== GPS_SECRET) return res.status(401).json({ error: "Unauthorized" });
    const { lat, lng, motion, timestamp } = req.body;
    if (typeof lat === "undefined" || typeof lng === "undefined") return res.status(400).json({ error: "lat/lng required" });
    await handleData({ lat: Number(lat), lng: Number(lng), motion: !!motion, timestamp: timestamp ?? Date.now() }, "gsm");
    return res.json({ ok: true });
  } catch (err) { logError(err.message, "http/gps"); return res.status(500).json({ error: "server error" }); }
});

app.post("/api/system/toggle", async (req, res) => {
  try {
    const { enabled } = req.body;
    const wasActive = SYSTEM_ACTIVE;
    SYSTEM_ACTIVE = !!enabled;
    logInfo(`System now ${SYSTEM_ACTIVE ? "ACTIVE ✅" : "INACTIVE ⛔"}`);
    if (SYSTEM_ACTIVE && !wasActive) { homeLocation = null; initialReadings = []; kalmanLat.x = kalmanLng.x = null; if (USE_MOCK_DATA) { await setMockHome(); startMockLoop(); } }
    else if (!SYSTEM_ACTIVE && wasActive) stopMockLoop();
    return res.json({ message: `System now ${SYSTEM_ACTIVE ? "ACTIVE ✅" : "INACTIVE ❌"}`, active: SYSTEM_ACTIVE });
  } catch (err) { logError(err.message, "system"); return res.status(500).json({ error: "server error" }); }
});

app.get("/api/logs", (req, res) => res.json(systemLogs.slice(-50)));
app.get("/api/notifications", (req, res) => res.json(notificationLogs.slice(-50)));
app.get("/api/system/status", (req, res) => res.json({ active: SYSTEM_ACTIVE, homeLocation, latestArduinoData }));
app.get("/api/arduino", (req, res) => res.json(latestArduinoData));
app.post("/api/push/register", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token required" });
  if (!pushTokens.includes(token)) pushTokens.push(token);
  return res.json({ ok: true, tokensCount: pushTokens.length });
});

app.get("/", (req, res) => res.send("✅ Backend running + Firebase connected"));

// ==========================
// 📡 MQTT
// ==========================
const mqttClient = mqtt.connect(MQTT_BROKER, { username: MQTT_USER, password: MQTT_PASSWORD, reconnectPeriod: 5000, connectTimeout: 30_000 });

mqttClient.on("connect", () => {
  logInfo("Connected to MQTT broker", "mqtt");
  for (const deviceId of DEVICES) {
    mqttClient.subscribe(`${deviceId}/gps`, err => err ? logError(err.message, "mqtt") : logInfo(`Subscribed ${deviceId}/gps`));
    mqttClient.subscribe(`${deviceId}/logs`, err => err ? logError(err.message, "mqtt") : logInfo(`Subscribed ${deviceId}/logs`));
  }
});

mqttClient.on("message", async (topic, msgBuffer) => {
  const rawMsg = msgBuffer.toString();
  let parsed = null;
  try { parsed = JSON.parse(rawMsg); } catch {}
  try {
    if (topic.endsWith("/gps") && parsed?.lat && parsed?.lng) await handleData({ lat: Number(parsed.lat), lng: Number(parsed.lng), motion: !!parsed.motion, timestamp: parsed.timestamp ?? Date.now() }, "mqtt");
    else if (topic.endsWith("/logs")) logSystem(parsed?.message ?? rawMsg, "mqtt", parsed ?? { raw: rawMsg });
  } catch (err) { logError(err.message ?? err, "mqtt_processing"); }
});

// ==========================
// 🚀 Start server
// ==========================
const PORT = process.env.PORT ?? 5000;
app.listen(PORT, () => {
  logInfo(`Server running on port ${PORT}`, "server");
  if (SYSTEM_AUTO_ON) { SYSTEM_ACTIVE = true; logInfo("SYSTEM_AUTO_ON enabled — activated at startup", "server"); }
});
