// index.js — Merged MotoGuard backend (GSM + Mock + MQTT + Firebase)
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const admin = require("./config/firebase"); // Firebase Admin SDK
const mqtt = require("mqtt");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// --------------------
// ⚙️ Configuration
// --------------------
const USE_ARDUINO = true; // USB serial disabled for GSM-only mode
const USE_MOCK_DATA = false;
const DISTANCE_THRESHOLD = Number(process.env.DISTANCE_THRESHOLD ?? 15); 
const GPS_NOISE_THRESHOLD = Number(process.env.GPS_NOISE_THRESHOLD ?? 5);
const HOME_READINGS_REQUIRED = Number(process.env.HOME_READINGS_REQUIRED ?? 3);
const MOCK_INTERVAL = Number(process.env.MOCK_INTERVAL ?? 5000); 
const REPORT_COOLDOWN_MS = Number(process.env.REPORT_COOLDOWN_MS ?? 60 * 1000); 
const GPS_SECRET = process.env.GPS_SECRET || null;

// MQTT config
const MQTT_BROKER = process.env.MQTT_BROKER || "mqtts://broker.hivemq.com:8883";
const MQTT_USER = process.env.MQTT_USER || "Kazuki";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "Nazuna12";
const DEVICES = (process.env.DEVICES || "esp32_01").split(",").map(s => s.trim()).filter(Boolean);

const MAX_LOGS = 200;

// --------------------
// ✅ Runtime state
// --------------------
let SYSTEM_ACTIVE = false;
let latestArduinoData = { error: "No data yet" };
let systemLogs = [];
let notificationLogs = [];
let homeLocation = null;
let initialReadings = [];
let policeStations = [];
let emergencyActive = false;
const lastReports = {}; // per-station cooldown
let _mockIntervalId = null;
let _mockLoopRunning = false;

// --------------------
// 🔧 Structured logger
// --------------------
function enqueueLog(entry) {
  systemLogs.push(entry);
  if (systemLogs.length > MAX_LOGS) systemLogs.shift();
}

function logSystem(message, source = "system", extra = {}) {
  const msg = (typeof message === "object") ? message : String(message);
  const logEntry = { timestamp: new Date().toISOString(), source, message: msg, ...extra };
  enqueueLog(logEntry);
  try { console.log("📥 LOG:", JSON.stringify(logEntry, null, 2)); } catch { console.log("📥 LOG [raw]:", logEntry); }
  return logEntry;
}

const logInfo = (m, s = "system", extra = {}) => logSystem(m, s, extra);
const logWarn = (m, s = "system", extra = {}) => logSystem(`WARN: ${m}`, s, extra);
const logError = (m, s = "system", extra = {}) => logSystem(`ERROR: ${m}`, s, extra);

// --------------------
// 🚓 Load Police Stations
// --------------------
async function loadPoliceStations() {
  try {
    const snapshot = await admin.firestore().collection("police_stations").get();
    policeStations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      lat: doc.data().position?.latitude ?? null,
      lng: doc.data().position?.longitude ?? null
    })).filter(s => s.lat !== null && s.lng !== null);
    logInfo(`Loaded ${policeStations.length} police stations`, "firestore");
  } catch (err) {
    logError(`Failed to load police stations: ${err.message}`, "firestore");
  }
}
loadPoliceStations();

// --------------------
// 🔧 Kalman Filter 1D
// --------------------
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

// --------------------
// 📏 Utility functions
// --------------------
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function getNearestStation(lat, lng, stations, maxDistance = 100) {
  let nearest = null, minDist = Infinity;
  for (const s of stations) {
    const d = getDistance(lat, lng, s.lat, s.lng);
    if (d < minDist) { minDist = d; nearest = { ...s, distance: d }; }
  }
  return nearest && nearest.distance <= maxDistance ? nearest : null;
}

// --------------------
// 🛠 Core GPS handler
// --------------------
async function handleData(data, source = "gsm", isMock = false) {
  if (typeof data.lat === "undefined" || typeof data.lng === "undefined") {
    logWarn("GPS data missing lat/lng", source, { data });
    return;
  }

  if (!SYSTEM_ACTIVE) {
    latestArduinoData = { ...data, system: "inactive" };
    logInfo("SYSTEM INACTIVE — GPS logged but no detection.", source, { data });
    return;
  }

  if (!homeLocation) {
    initialReadings.push({ lat: data.lat, lng: data.lng });
    logInfo("Home setup progress", "calibration", { progress: initialReadings.length, required: HOME_READINGS_REQUIRED });
    if (initialReadings.length >= HOME_READINGS_REQUIRED) {
      homeLocation = {
        lat: initialReadings.reduce((sum,r) => sum + r.lat,0)/initialReadings.length,
        lng: initialReadings.reduce((sum,r) => sum + r.lng,0)/initialReadings.length
      };
      kalmanLat.x = null; kalmanLng.x = null;
      logInfo("Home location established", "calibration", { homeLocation });
    } else {
      latestArduinoData = { lat: data.lat, lng: data.lng, timestamp: data.timestamp ?? Date.now(), system: "calibrating" };
      return;
    }
  }

  const lat = isMock ? data.lat : kalmanLat.filter(data.lat);
  const lng = isMock ? data.lng : kalmanLng.filter(data.lng);
  const distanceFromHome = getDistance(homeLocation.lat, homeLocation.lng, lat, lng);
  const moved = distanceFromHome > GPS_NOISE_THRESHOLD;

  latestArduinoData = { lat, lng, timestamp: data.timestamp ?? Date.now(), distance: distanceFromHome, moved, source };
  logInfo("Processed GPS", "gps", { lat, lng, distanceFromHome, moved, source });

  // Normal / Warning / Emergency
  if (distanceFromHome < 11) {
    emergencyActive = false;
    try { await admin.database().ref("device1/history").push({ ...latestArduinoData, status: "normal", createdAt: admin.database.ServerValue.TIMESTAMP }); } catch (e) { logWarn("RTDB push failed (normal)", "firebase", { error:e.message }); }
    return;
  }

  const nearest = getNearestStation(lat, lng, policeStations, 100);

  if (distanceFromHome >= 11 && distanceFromHome < DISTANCE_THRESHOLD) {
    const warningData = {
      lat, lng, distance: distanceFromHome, type: "warning", message: "Warning Alert",
      station_id: nearest?.id ?? null, station_name: nearest?.name ?? nearest?.stationName ?? null,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    try { await admin.firestore().collection("notifications").add(warningData); } catch (e) { logWarn("Firestore add notifications failed", "firestore", { error:e.message }); }
    notificationLogs.push({ number: nearest?.contact_number ?? nearest?.contactNumber ?? "N/A", message: "Warning Alert", type: "warning", date: new Date().toLocaleString(), timestamp: new Date() });
    try { await admin.database().ref("device1/history").push({ ...latestArduinoData, status: "warning", createdAt: admin.database.ServerValue.TIMESTAMP }); } catch (e) { logWarn("RTDB push failed (warning)", "firebase", { error:e.message }); }
    return;
  }

  if (!nearest) {
    logWarn("No nearby station within 100m — cannot auto-report", "gps", { lat, lng });
    return;
  }

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
  try { await admin.firestore().collection("auto_reports").add(autoReport); } catch (e) { logWarn("Firestore add auto_reports failed", "firestore", { error:e.message }); }
  notificationLogs.push({ number: nearest?.contact_number ?? "N/A", message: "Emergency reported", type: "emergency", date: new Date().toLocaleString(), timestamp: new Date() });
  try { await admin.database().ref("device1/history").push({ ...latestArduinoData, status: "emergency", createdAt: admin.database.ServerValue.TIMESTAMP }); } catch (e) { logWarn("RTDB push failed (emergency)", "firebase", { error:e.message }); }
  logInfo("Emergency reported", "auto_report", { nearest, latestArduinoData });
}

// --------------------
// 🌐 HTTP endpoints
// --------------------
app.post("/api/gps", async (req,res) => {
  try {
    if (GPS_SECRET && req.header("x-gps-secret") !== GPS_SECRET) return res.status(401).json({ error: "Unauthorized" });
    const { lat, lng, timestamp } = req.body;
    if (typeof lat === "undefined" || typeof lng === "undefined") return res.status(400).json({ error: "lat and lng required" });
    await handleData({ lat: Number(lat), lng: Number(lng), timestamp: timestamp ?? Date.now() }, "gsm");
    return res.json({ ok:true });
  } catch(err){ logError(err.message ?? err, "http/gps"); res.status(500).json({error:"server error"}); }
});

app.post("/api/logs", (req,res) => {
  try{
    const { message, source, extra } = req.body;
    if(!message) return res.status(400).json({ error:"Log message required" });
    const entry = logSystem(message, source ?? "arduino", extra ?? {});
    return res.json({ status:"ok", log: entry });
  } catch(err){ logError(err.message ?? err, "http/logs"); return res.status(500).json({error:"server error"});}
});

app.get("/api/logs", (req,res) => res.json(systemLogs.slice(-50)));
app.get("/api/notifications", (req,res) => res.json(notificationLogs.slice(-50)));
app.get("/api/system/status", (req,res) => res.json({ active: SYSTEM_ACTIVE, homeLocation, latestArduinoData }));
app.get("/", (req,res) => res.send("✅ Backend running + Firebase RTDB + Firestore connected"));

// --------------------
// 📡 MQTT integration
// --------------------
const mqttClient = mqtt.connect(MQTT_BROKER, { username: MQTT_USER, password: MQTT_PASSWORD, reconnectPeriod:5000, connectTimeout:30000 });
mqttClient.on("connect", () => {
  logInfo("Connected to MQTT broker", "mqtt");
  for(const deviceId of DEVICES){
    mqttClient.subscribe(`${deviceId}/gps`, err=> err ? logError(err.message,"mqtt") : logInfo(`Subscribed to ${deviceId}/gps`));
    mqttClient.subscribe(`${deviceId}/logs`, err=> err ? logError(err.message,"mqtt") : logInfo(`Subscribed to ${deviceId}/logs`));
  }
});
mqttClient.on("message", async (topic,msgBuffer) => {
  const rawMsg = msgBuffer.toString();
  logInfo("Raw MQTT message", "mqtt_raw",{topic,rawMsg});
  let parsed=null; try{ parsed=JSON.parse(rawMsg);} catch{}
  if(topic.endsWith("/gps") && parsed?.lat && parsed?.lng){ await handleData({ lat:Number(parsed.lat), lng:Number(parsed.lng), timestamp: parsed.timestamp ?? Date.now() }, "mqtt", false);}
  else if(topic.endsWith("/logs")){ logSystem(parsed?.message ?? rawMsg, "mqtt", parsed ?? { raw: rawMsg }); }
});

// --------------------
// 🚀 Start server
// --------------------
const PORT = process.env.PORT ?? 5000;
app.listen(PORT, ()=>logInfo(`Server running on port ${PORT}`));
