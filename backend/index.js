const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

// ✅ Firebase Admin SDK
const admin = require("./config/firebase");

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// --------------------
// ⚙️ Configuration
// --------------------
const USE_ARDUINO = false;
const USE_MOCK_DATA = true;
const ARDUINO_PORT = "COM3";
const BAUD_RATE = 9600;
const DISTANCE_THRESHOLD = 15; // meters
const GPS_NOISE_THRESHOLD = 5;
const HOME_READINGS_REQUIRED = 3;
const MOCK_INTERVAL = 5000; // 5 seconds
const REPORT_COOLDOWN_MS = 60 * 1000; // 1 minute

let latestArduinoData = { error: "No data yet" };
let systemLogs = [];
let notificationLogs = [];
let homeLocation = null;
let initialReadings = [];
let policeStations = [];
let emergencyActive = false;

// ⏱ Track last emergency report time per station
const lastReports = {};

// --------------------
// 🚓 Load Police Stations
// --------------------
async function loadPoliceStations() {
  try {
    const snapshot = await admin.firestore().collection("police_stations").get();
    policeStations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      lat: doc.data().position.latitude,
      lng: doc.data().position.longitude,
    }));
    console.log(`🚓 Loaded ${policeStations.length} police stations`);
  } catch (err) {
    console.error("❌ Failed to load police stations:", err.message);
  }
}
loadPoliceStations();

// --------------------
// 🔧 Kalman Filter
// --------------------
class KalmanFilter1D {
  constructor(R = 0.00001, Q = 0.0001) {
    this.R = R;
    this.Q = Q;
    this.x = null;
    this.P = 1;
  }
  filter(z) {
    if (this.x === null) {
      this.x = z;
      return z;
    }
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
// 🔢 Haversine Formula
// --------------------
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

// --------------------
// 🧭 Find nearest station
// --------------------
function getNearestStation(lat, lng, stations, maxDistance = 100) {
  let nearest = null;
  let minDist = Infinity;
  for (const station of stations) {
    const distance = getDistance(lat, lng, station.lat, station.lng);
    if (distance < minDist) {
      minDist = distance;
      nearest = { ...station, distance };
    }
  }
  return nearest && nearest.distance <= maxDistance ? nearest : null;
}

// --------------------
// 🔧 Handle incoming GPS data
// --------------------
async function handleData(data, arduinoPort, isMock = false) {
  if (!data.lat || !data.lng) return;

  // Step 1: Establish home
  if (!homeLocation) {
    initialReadings.push({ lat: data.lat, lng: data.lng });
    if (initialReadings.length >= HOME_READINGS_REQUIRED) {
      homeLocation = {
        lat: initialReadings.reduce((sum, r) => sum + r.lat, 0) / initialReadings.length,
        lng: initialReadings.reduce((sum, r) => sum + r.lng, 0) / initialReadings.length,
      };
      console.log("🏠 Home location set:", homeLocation);
    } else return;
  }

  // Step 2: Smooth coordinates
  const smoothedLat = isMock ? data.lat : kalmanLat.filter(data.lat);
  const smoothedLng = isMock ? data.lng : kalmanLng.filter(data.lng);

  // Step 3: Measure distance
  const distance = getDistance(homeLocation.lat, homeLocation.lng, smoothedLat, smoothedLng);
  const moved = distance > GPS_NOISE_THRESHOLD;
  latestArduinoData = { ...data, distance, moved };

  console.log("📩 Data after smoothing:", latestArduinoData);

  // ------------------------------
  // ✅ NORMAL: 0–10m
  // ------------------------------
  if (distance < 11) {
    if (emergencyActive) {
      console.log("✅ Vehicle returned to safe zone. Emergency cleared.");
      emergencyActive = false;
    }

    console.log(`✅ Safe movement (${distance.toFixed(2)}m) — below warning threshold.`);

    await admin.database().ref("device1/history").push({
      ...latestArduinoData,
      status: "normal",
      createdAt: admin.database.ServerValue.TIMESTAMP,
    });

    if (arduinoPort) arduinoPort.write("BUZZ_OFF\n");
    return;
  }

  // ------------------------------
  // ⚠️ WARNING: 11–14m
  // ------------------------------
    if (distance >= 11 && distance < DISTANCE_THRESHOLD) {
    console.log(`⚠️ Warning — ${distance.toFixed(2)}m from home!`);

    const nearestStation = getNearestStation(smoothedLat, smoothedLng, policeStations, 100);
    const warningData = {
      lat: smoothedLat,
      lng: smoothedLng,
      distance,
      type: "warning",
      message: "Warning Alert", // ✅ simplified message
      station_id: nearestStation ? nearestStation.id : null,
      station_name: nearestStation
        ? nearestStation.name || nearestStation.stationName
        : null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 🔔 Save warning notification to Firestore
    await admin.firestore().collection("notifications").add(warningData);
    console.log("⚠️ Warning notification saved to Firestore");

    // ✅ Push to in-memory logs (so frontend can display it)
    notificationLogs.push({
      number: nearestStation ? nearestStation.contact_number || "N/A" : "N/A",
      message: "Warning Alert", // ✅ simplified message
      type: "warning",
      date: new Date().toLocaleString(),
      timestamp: new Date(),
    });
    console.log("⚠️ Warning notification added to memory");

    // Optional: also log to RTDB
    await admin.database().ref("device1/history").push({
      ...latestArduinoData,
      status: "warning",
      createdAt: admin.database.ServerValue.TIMESTAMP,
    });

    if (arduinoPort) arduinoPort.write("BUZZ_OFF\n");
    return;
  }

  // ------------------------------
  // 🚨 EMERGENCY: 15m or more
  // ------------------------------
  const nearestStation = getNearestStation(smoothedLat, smoothedLng, policeStations, 100);
  if (!nearestStation) {
    console.log("🚨 No nearby station within 100m radius");
    return;
  }

  const stationId = nearestStation.id;
  const now = Date.now();

  if (lastReports[stationId] && now - lastReports[stationId] < REPORT_COOLDOWN_MS) {
    console.log(
      `⏱ Duplicate emergency skipped for ${nearestStation.name || nearestStation.stationName}`
    );
    return;
  }

  lastReports[stationId] = now;
  emergencyActive = true;

  console.log(
    `🚨 Nearest station: ${nearestStation.name || nearestStation.stationName} (${nearestStation.distance.toFixed(
      2
    )}m)`
  );

  const contactNumber =
    nearestStation.contact_number || nearestStation.contactNumber || null;

  const autoReport = {
    station_id: stationId,
    station_name: nearestStation.name || nearestStation.stationName || "Unknown",
    lat: smoothedLat,
    lng: smoothedLng,
    distance: nearestStation.distance,
    contact_number: contactNumber,
    source: isMock ? "mock" : "arduino",
    status: "emergency",
    message: "Vehicle moved beyond safety threshold — possible theft detected",
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await admin.firestore().collection("auto_reports").add(autoReport);
    console.log("✅ Emergency auto-report saved to Firestore");

    // 🔔 Add emergency notification
    const notification = {
      number: contactNumber || "N/A",
      message: "Emergency reported",
      type: "emergency",
      date: new Date().toLocaleString(),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    notificationLogs.push(notification);
    await admin.firestore().collection("notifications").add(notification);
    console.log("🔔 Emergency notification saved to Firestore and memory");
  } catch (err) {
    console.error("❌ Failed to save emergency report or notification:", err.message);
  }

  if (arduinoPort) arduinoPort.write("BUZZ_ON\n");

  await admin.database().ref("device1/history").push({
    ...latestArduinoData,
    status: "emergency",
    createdAt: admin.database.ServerValue.TIMESTAMP,
  });
}

// --------------------
// 🔌 Arduino Setup
// --------------------
if (USE_ARDUINO) {
  console.log("🔗 Using REAL Arduino on", ARDUINO_PORT);
  const arduinoPort = new SerialPort({ path: ARDUINO_PORT, baudRate: BAUD_RATE });
  const parser = arduinoPort.pipe(new ReadlineParser({ delimiter: "\n" }));

  parser.on("data", async (line) => {
    line = line.trim();
    if (!line) return;

    if (!line.startsWith("{") || !line.endsWith("}")) {
      console.log("ℹ️ System Log:", line);
      systemLogs.push({ message: line, time: Date.now() });
      return;
    }

    try {
      const data = JSON.parse(line);
      await handleData(data, arduinoPort);
    } catch (err) {
      console.error("❌ Failed to parse JSON:", line, err.message);
    }
  });

  arduinoPort.on("error", (err) => console.error("❌ Serial Port Error:", err.message));
}

// --------------------
// 🧪 Mock Data Setup
// --------------------
if (USE_MOCK_DATA) {
  console.log("🧪 Using MOCK DATA near police stations");

  async function setMockHome() {
    while (policeStations.length === 0) {
      console.log("⏳ Waiting for police stations to load...");
      await new Promise((r) => setTimeout(r, 1000));
    }
    const base = policeStations[0];
    homeLocation = { lat: base.lat, lng: base.lng };
    console.log("🏠 Mock home location fixed near:", base.name || base.stationName);
  }

  function generateRandomPointNearHome(minDist = 1, maxDist = 30) {
    const distance = minDist + Math.random() * (maxDist - minDist);
    const angle = Math.random() * 2 * Math.PI;
    const R = 6371000;
    const δ = distance / R;
    const lat1 = (homeLocation.lat * Math.PI) / 180;
    const lng1 = (homeLocation.lng * Math.PI) / 180;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(δ) +
        Math.cos(lat1) * Math.sin(δ) * Math.cos(angle)
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(angle) * Math.sin(δ) * Math.cos(lat1),
        Math.cos(δ) - Math.sin(lat1) * Math.sin(lat2)
      );

    return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
  }

  async function startMockData() {
    await setMockHome();
    console.log(`✅ Starting mock simulation near home location`);

    setInterval(async () => {
      const point = generateRandomPointNearHome(1, 20);
      const data = { lat: point.lat, lng: point.lng, timestamp: Date.now() };
      console.log(`📍 Generated mock GPS point: (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`);
      await handleData(data, null, true);
    }, MOCK_INTERVAL);
  }

  startMockData();
}

// --------------------
// 🌐 API Routes
// --------------------
const userRoutes = require("./routes/users");
const reportRoutes = require("./routes/reportRoutes");

app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);

app.get("/api/arduino", (req, res) => res.json(latestArduinoData));
app.get("/api/logs", (req, res) => res.json(systemLogs.slice(-20)));
app.get("/api/notifications", (req, res) => res.json(notificationLogs.slice(-20)));
app.get("/", (req, res) =>
  res.send("✅ Backend running + Firebase RTDB + Firestore connected")
);

// --------------------
// 🚀 Start Server
// --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
