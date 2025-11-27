// index.js — MotoGuard backend (Express + Firebase + MQTT)
// Full rewritten: MQTT + GSM + Mock + all previous endpoints

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

const DISTANCE_THRESHOLD = Number(process.env.DISTANCE_THRESHOLD ?? 15); // meters
const GPS_NOISE_THRESHOLD = Number(process.env.GPS_NOISE_THRESHOLD ?? 5); // meters
const HOME_READINGS_REQUIRED = Number(process.env.HOME_READINGS_REQUIRED ?? 3);
const REPORT_COOLDOWN_MS = Number(process.env.REPORT_COOLDOWN_MS ?? 60 * 1000);

const MQTT_BROKER = process.env.MQTT_BROKER || "mqtts://cee1784455524214820f3387732533d6.s1.eu.hivemq.cloud:8883";
const MQTT_USER = process.env.MQTT_USER || "Kazuki";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "Nazuna12";

// Comma-separated list of device IDs to subscribe to, e.g. "esp32_01,esp32_02"
const DEVICES = (process.env.DEVICES || "esp32_01").split(",").map(s => s.trim()).filter(Boolean);

// Mock / GSM config
const USE_ARDUINO = true;
const USE_MOCK_DATA = false;
const MOCK_INTERVAL = 5000;

// Max logs to keep in memory
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

// Mock loop control
let _mockIntervalId = null;
let _mockLoopRunning = false;

// ==========================
// 🔧 Structured logger
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
  try {
    console.log("📥 LOG:", JSON.stringify(logEntry, null, 2));
  } catch (e) {
    console.log("📥 LOG [raw]:", logEntry);
  }
  return logEntry;
}

const logInfo = (m, s = "system", extra = {}) => logSystem(m, s, extra);
const logWarn = (m, s = "system", extra = {}) => logSystem(`WARN: ${m}`, s, extra);
const logError = (m, s = "system", extra = {}) => logSystem(`ERROR: ${m}`, s, extra);

// ==========================
// 🚓 Load police stations (Firestore)
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
  let tries = 0;
  while (policeStations.length === 0 && tries < 30) {
    logInfo("Waiting for police stations to load for mock home...");
    await new Promise(r => setTimeout(r, 1000));
    tries++;
  }
  if (policeStations.length === 0) {
    logWarn("No police stations available — mock home not set");
    return;
  }
  const base = policeStations[0];
  if (SYSTEM_ACTIVE) {
    homeLocation = { lat: base.lat, lng: base.lng };
    initialReadings = [];
    kalmanLat.x = null; kalmanLng.x = null;
    logInfo("🏠 Mock home location set near " + (base.name || base.stationName));
  } else {
    logWarn("⛔ Mock home NOT set — system is OFF");
  }
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
  logInfo("Starting mock GPS simulation loop");

  _mockIntervalId = setInterval(async () => {
    if (!SYSTEM_ACTIVE || !homeLocation) return;
    const point = generateRandomPointNearHome(1, 20);
    if (!point) return;
    await handleData({ lat: point.lat, lng: point.lng, timestamp: Date.now() }, "mock", true);
  }, MOCK_INTERVAL);
}

function stopMockLoop() {
  if (_mockIntervalId) {
    clearInterval(_mockIntervalId);
    _mockIntervalId = null;
    _mockLoopRunning = false;
    logInfo("Mock loop stopped");
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
    logInfo("SYSTEM INACTIVE — GPS logged but no detection.", "system", { data });
    return;
  }

  // Home calibration
  if (!homeLocation) {
    initialReadings.push({ lat: data.lat, lng: data.lng });
    logInfo("Home setup progress", "calibration", { progress: initialReadings.length, required: HOME_READINGS_REQUIRED });

    if (initialReadings.length >= HOME_READINGS_REQUIRED) {
      homeLocation = {
        lat: initialReadings.reduce((sum, r) => sum + r.lat, 0) / initialReadings.length,
        lng: initialReadings.reduce((sum, r) => sum + r.lng, 0) / initialReadings.length
      };
      kalmanLat.x = null; kalmanLng.x = null;
      logInfo("Home location established", "calibration", { homeLocation });
    } else {
      latestArduinoData = { lat: data.lat, lng: data.lng, motion: !!data.motion, timestamp: data.timestamp ?? Date.now(), system: "calibrating" };
      return;
    }
  }

  const lat = isMock ? data.lat : kalmanLat.filter(data.lat);
  const lng = isMock ? data.lng : kalmanLng.filter(data.lng);
  const distanceFromHome = getDistance(homeLocation.lat, homeLocation.lng, lat, lng);
  const moved = distanceFromHome > GPS_NOISE_THRESHOLD;

  latestArduinoData = { lat, lng, motion: !!data.motion, timestamp: data.timestamp ?? Date.now(), distance: distanceFromHome, moved, source };
  logInfo("Processed GPS", "gps", { lat, lng, distanceFromHome, moved, source });

  // Warning and emergency handling (same as previous MQTT code)
  if (distanceFromHome < 11) {
    emergencyActive = false;
    try { await admin.database().ref("device1/history").push({ ...latestArduinoData, status: "normal", createdAt: admin.database.ServerValue.TIMESTAMP }); } catch (e) { logWarn("RTDB push failed (normal)", "firebase", { error: e.message }); }
    return;
  }

  const nearest = getNearestStation(lat, lng, policeStations, 100);
  if (distanceFromHome >= 11 && distanceFromHome < DISTANCE_THRESHOLD) {
    const warningData = {
      lat, lng, distance: distanceFromHome, type: "warning", message: "Warning Alert",
      station_id: nearest?.id ?? null, station_name: nearest?.name ?? nearest?.stationName ?? null,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    try { await admin.firestore().collection("notifications").add(warningData); } catch (e) { logWarn("Firestore add notifications failed", "firestore", { error: e.message }); }
    notificationLogs.push({ number: nearest?.contact_number ?? nearest?.contactNumber ?? "N/A", message: "Warning Alert", type: "warning", date: new Date().toLocaleString(), timestamp: new Date() });
    try { await admin.database().ref("device1/history").push({ ...latestArduinoData, status: "warning", createdAt: admin.database.ServerValue.TIMESTAMP }); } catch (e) { logWarn("RTDB push failed (warning)", "firebase", { error: e.message }); }
    return;
  }

  if (!nearest) return;

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
  try { await admin.firestore().collection("auto_reports").add(autoReport); } catch (e) { logWarn("Firestore add auto_reports failed", "firestore", { error: e.message }); }
  notificationLogs.push({ number: nearest?.contact_number ?? "N/A", message: "Emergency reported", type: "emergency", date: new Date().toLocaleString(), timestamp: new Date() });
  try { await admin.database().ref("device1/history").push({ ...latestArduinoData, status: "emergency", createdAt: admin.database.ServerValue.TIMESTAMP }); } catch (e) { logWarn("RTDB push failed (emergency)", "firebase", { error: e.message }); }
  logInfo("Emergency reported", "auto_report", { nearest, latestArduinoData });
}

// ==========================
// 🌐 HTTP endpoints
// ==========================
app.post("/api/gps", async (req, res) => {
  try {
    if (GPS_SECRET && req.header("x-gps-secret") !== GPS_SECRET) return res.status(401).json({ error: "Unauthorized" });
    const { lat, lng, motion, timestamp } = req.body;
    if (typeof lat === "undefined" || typeof lng === "undefined") return res.status(400).json({ error: "lat and lng required" });

    await handleData({ lat: Number(lat), lng: Number(lng), motion: !!motion, timestamp: timestamp ?? Date.now() }, "gsm");
    return res.json({ ok: true });
  } catch (err) {
    logError(err.message ?? err, "http/gps");
    return res.status(500).json({ error: "server error" });
  }
});

app.post("/api/logs", (req, res) => {
  try {
    const { message, source, extra } = req.body;
    if (!message) return res.status(400).json({ error: "Log message required" });
    const entry = logSystem(message, source ?? "arduino", extra ?? {});
    return res.json({ status: "ok", log: entry });
  } catch (err) {
    logError(err.message ?? err, "http/logs");
    return res.status(500).json({ error: "server error" });
  }
});

app.get("/api/logs", (req, res) => res.json(systemLogs.slice(-50)));
app.get("/api/notifications", (req, res) => res.json(notificationLogs.slice(-50)));
app.get("/api/system/status", (req, res) => res.json({ active: SYSTEM_ACTIVE, homeLocation, latestArduinoData }));
app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// System toggle route
app.post("/api/system/toggle", async (req, res) => {
  try {
    const { enabled } = req.body;
    const wasActive = SYSTEM_ACTIVE;
    SYSTEM_ACTIVE = !!enabled;

    logInfo(`System is now ${SYSTEM_ACTIVE ? "ACTIVE ✅" : "INACTIVE ⛔"}`);

    if (SYSTEM_ACTIVE && !wasActive) {
      homeLocation = null;
      initialReadings = [];
      kalmanLat.x = null;
      kalmanLng.x = null;
      if (USE_MOCK_DATA) { await setMockHome(); startMockLoop(); }
    } else if (!SYSTEM_ACTIVE && wasActive) { if (USE_MOCK_DATA) stopMockLoop(); }

    res.json({ message: `System is now ${SYSTEM_ACTIVE ? "ACTIVE ✅" : "INACTIVE ❌"}`, active: SYSTEM_ACTIVE });
  } catch (err) {
    logError("Toggle error: " + err.message, "system");
    res.status(500).json({ error: "server error" });
  }
});

// Optional routes from old code
const userRoutes = require("./routes/users");
const reportRoutes = require("./routes/reportRoutes");
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);

// Diagnostic endpoints
app.get("/api/arduino", (req, res) => res.json(latestArduinoData));

// Root
app.get("/", (req, res) => res.send("✅ Backend running + Firebase RTDB + Firestore connected"));

// ==========================
// 📡 MQTT integration
// ==========================
const mqttClient = mqtt.connect(MQTT_BROKER, {
  username: MQTT_USER,
  password: MQTT_PASSWORD,
  reconnectPeriod: 5000,
  connectTimeout: 30_000
});

mqttClient.on("connect", () => {
  logInfo("Connected to MQTT broker", "mqtt");
  for (const deviceId of DEVICES) {
    mqttClient.subscribe(`${deviceId}/gps`, err => err ? logError(err.message, "mqtt") : logInfo(`Subscribed ${deviceId}/gps`, "mqtt"));
    mqttClient.subscribe(`${deviceId}/logs`, err => err ? logError(err.message, "mqtt") : logInfo(`Subscribed ${deviceId}/logs`, "mqtt"));
  }
});

mqttClient.on("reconnect", () => logInfo("MQTT reconnecting...", "mqtt"));
mqttClient.on("close", () => logWarn("MQTT connection closed", "mqtt"));
mqttClient.on("error", (err) => logError(`MQTT client error: ${err.message ?? err}`, "mqtt"));

mqttClient.on("message", async (topic, msgBuffer) => {
  const rawMsg = msgBuffer.toString();
  logInfo("Raw MQTT message received", "mqtt_raw", { topic, rawMsg });
  let parsed = null;
  try { parsed = JSON.parse(rawMsg); } catch (err) { logWarn("MQTT payload is not JSON", "mqtt", { topic, rawMsg }); }

  try {
    if (topic.endsWith("/gps") && parsed?.lat !== undefined && parsed?.lng !== undefined) {
      await handleData({ lat: Number(parsed.lat), lng: Number(parsed.lng), motion: !!parsed.motion, timestamp: parsed.timestamp ?? Date.now() }, "mqtt");
    } else if (topic.endsWith("/logs")) {
      const messageToStore = parsed?.message ?? rawMsg;
      const logEntry = logSystem(messageToStore, "mqtt", parsed ?? { raw: rawMsg });
      if (systemLogs.length > MAX_LOGS) systemLogs.shift();
      logInfo("Stored MQTT log", "mqtt", { topic, logEntry });
    } else {
      logInfo("Unhandled MQTT topic", "mqtt", { topic, rawMsg });
    }
  } catch (err) {
    logError(`Error processing MQTT message: ${err.message ?? err}`, "mqtt_processing");
  }
});

// ==========================
// 🚀 Start server
// ==========================
const PORT = process.env.PORT ?? 5000;
app.listen(PORT, () => {
  logInfo(`Server running on port ${PORT}`, "server");
  if (SYSTEM_AUTO_ON) { SYSTEM_ACTIVE = true; logInfo("SYSTEM_AUTO_ON enabled — system activated at startup", "server"); }
});
