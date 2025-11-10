// index.js (GSM-only backend + mock support)
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Firebase Admin SDK
const admin = require("./config/firebase");

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// app.enable("trust proxy");
// app.use((req, res, next) => {
//   if (req.headers["x-forwarded-proto"] === "https") {
//     return res.redirect("http://" + req.headers.host + req.url);
//   }
//   next();
// });

// --------------------
// ⚙️ Configuration
// --------------------
const USE_ARDUINO = true; // USB serial disabled for GSM-only mode
const USE_MOCK_DATA = false; // keep mock simulation if you want
const DISTANCE_THRESHOLD = 15; // emergency threshold (meters)
const GPS_NOISE_THRESHOLD = 5; // noise threshold (meters)
const HOME_READINGS_REQUIRED = 3;
const MOCK_INTERVAL = 5000; // ms between mock samples
const REPORT_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown per station

// Optional shared secret for GPS posts (put in .env as GPS_SECRET)
const GPS_SECRET = process.env.GPS_SECRET || null;

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
const lastReports = {}; // per-station cooldown tracking

// Mock loop control
let _mockIntervalId = null;
let _mockLoopRunning = false;

// --------------------
// 🚓 Load Police Stations (from Firestore)
// --------------------
async function loadPoliceStations() {
  try {
    const snapshot = await admin.firestore().collection("police_stations").get();
    policeStations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Expect position to be a GeoPoint-like object with lat/lng
      lat: doc.data().position?.latitude ?? null,
      lng: doc.data().position?.longitude ?? null,
    })).filter(s => s.lat !== null && s.lng !== null);

    console.log(`🚓 Loaded ${policeStations.length} police stations`);
  } catch (err) {
    console.error("❌ Failed to load police stations:", err.message);
  }
}
loadPoliceStations();

// --------------------
// 🔧 Kalman Filter (1D) for smoothing lat/lng
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
// 🔢 Haversine distance (meters)
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
// 🧭 Find nearest station (uses motorcycle coords)
// --------------------
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

// --------------------
// 🔧 Core handler: process incoming GPS (from GSM or mock)
// --------------------
async function handleData(data, source = "gsm", isMock = false) {
  // Basic validation
  if (typeof data.lat === "undefined" || typeof data.lng === "undefined") {
    console.log("⚠️ Incoming GPS missing lat/lng, ignoring");
    return;
  }

  // If system is not active: just keep last reading but do not calibrate or alert
  if (!SYSTEM_ACTIVE) {
    latestArduinoData = { ...data, system: "inactive" };
    console.log("⛔ SYSTEM INACTIVE — GPS logged but no detection.");
    return;
  }

  // If home not set yet — use initial readings (calibration) only while system active
  if (!homeLocation) {
    initialReadings.push({ lat: data.lat, lng: data.lng });
    console.log(`🏠 Home setup progress: ${initialReadings.length}/${HOME_READINGS_REQUIRED}`);

    if (initialReadings.length >= HOME_READINGS_REQUIRED) {
      homeLocation = {
        lat: initialReadings.reduce((s, r) => s + r.lat, 0) / initialReadings.length,
        lng: initialReadings.reduce((s, r) => s + r.lng, 0) / initialReadings.length,
      };
      // Reset kalman filters to avoid bias from previous runs
      kalmanLat.x = null;
      kalmanLng.x = null;

      console.log("✅ Home location established:", homeLocation);
    } else {
      // update last reading and return until calibration complete
      latestArduinoData = { lat: data.lat, lng: data.lng, timestamp: data.timestamp || Date.now(), system: "calibrating" };
      return;
    }
  }

  // Smooth coordinates (Kalman) unless it's mock and you prefer no smoothing for mock
  const smoothedLat = isMock ? data.lat : kalmanLat.filter(data.lat);
  const smoothedLng = isMock ? data.lng : kalmanLng.filter(data.lng);

  const distanceFromHome = getDistance(homeLocation.lat, homeLocation.lng, smoothedLat, smoothedLng);
  const moved = distanceFromHome > GPS_NOISE_THRESHOLD;

  latestArduinoData = {
    lat: smoothedLat,
    lng: smoothedLng,
    timestamp: data.timestamp || Date.now(),
    distance: distanceFromHome,
    moved,
    source,
  };

  // Useful logs similar to what you wanted
  if (distanceFromHome < 11) {
    console.log(`✅ Safe movement (${distanceFromHome.toFixed(2)}m) — below warning threshold.`);
    console.log(`📩 Data after smoothing: ${JSON.stringify(latestArduinoData)}`);
    // push normal status to RTDB
    try {
      await admin.database().ref("device1/history").push({
        ...latestArduinoData,
        status: "normal",
        createdAt: admin.database.ServerValue.TIMESTAMP,
      });
    } catch (err) {
      console.error("❌ Failed to push normal to RTDB:", err.message);
    }
    emergencyActive = false;
    return;
  }

  // Warning range
  if (distanceFromHome >= 11 && distanceFromHome < DISTANCE_THRESHOLD) {
    console.log(`⚠️ Warning — ${distanceFromHome.toFixed(2)}m from home!`);
    const nearestStation = getNearestStation(smoothedLat, smoothedLng, policeStations, 100);

    const warningData = {
      lat: smoothedLat,
      lng: smoothedLng,
      distance: distanceFromHome,
      type: "warning",
      message: "Warning Alert",
      station_id: nearestStation ? nearestStation.id : null,
      station_name: nearestStation ? (nearestStation.name || nearestStation.stationName) : null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
      await admin.firestore().collection("notifications").add(warningData);
      console.log("⚠️ Warning notification saved to Firestore");
    } catch (err) {
      console.error("❌ Failed to save warning notification:", err.message);
    }

    notificationLogs.push({
      number: nearestStation ? (nearestStation.contact_number || nearestStation.contactNumber || "N/A") : "N/A",
      message: "Warning Alert",
      type: "warning",
      date: new Date().toLocaleString(),
      timestamp: new Date(),
    });

    try {
      await admin.database().ref("device1/history").push({
        ...latestArduinoData,
        status: "warning",
        createdAt: admin.database.ServerValue.TIMESTAMP,
      });
    } catch (err) {
      console.error("❌ Failed to push warning to RTDB history:", err.message);
    }

    return;
  }

  // Emergency range
  console.log("🚨 EMERGENCY: Vehicle moved beyond safety threshold!");
  const nearestStation = getNearestStation(smoothedLat, smoothedLng, policeStations, 100);
  if (!nearestStation) {
    console.log("🚨 No nearby station within 100m radius — cannot auto-report.");
    return;
  }

  const stationId = nearestStation.id;
  const now = Date.now();
  if (lastReports[stationId] && now - lastReports[stationId] < REPORT_COOLDOWN_MS) {
    console.log(`⏱ Emergency skipped — cooldown active for ${nearestStation.name || nearestStation.stationName}`);
    return;
  }
  lastReports[stationId] = now;
  emergencyActive = true;

  console.log(`🚨 Nearest station: ${nearestStation.name || nearestStation.stationName} (${nearestStation.distance.toFixed(2)}m)`);

  const contactNumber = nearestStation.contact_number || nearestStation.contactNumber || null;

  const autoReport = {
    station_id: stationId,
    station_name: nearestStation.name || nearestStation.stationName || "Unknown",
    lat: smoothedLat,
    lng: smoothedLng,
    distance: nearestStation.distance,
    contact_number: contactNumber,
    source: isMock ? "mock" : "gsm",
    status: "emergency",
    message: "Vehicle moved beyond safety threshold — possible theft detected",
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await admin.firestore().collection("auto_reports").add(autoReport);
    console.log("✅ Emergency auto-report saved to Firestore");
  } catch (err) {
    console.error("❌ Failed to save emergency auto-report:", err.message);
  }

  const notification = {
    number: contactNumber || "N/A",
    message: "Emergency reported",
    type: "emergency",
    date: new Date().toLocaleString(),
    timestamp: new Date(),
  };

  notificationLogs.push(notification);

  try {
    await admin.firestore().collection("notifications").add(notification);
    console.log("🔔 Emergency notification saved");
  } catch (err) {
    console.error("❌ Failed to save emergency notification:", err.message);
  }

  try {
    await admin.database().ref("device1/history").push({
      ...latestArduinoData,
      status: "emergency",
      createdAt: admin.database.ServerValue.TIMESTAMP,
    });
  } catch (err) {
    console.error("❌ Failed to push emergency to RTDB history:", err.message);
  }
}

// --------------------
// 🌐 GSM endpoint (Arduino SIM800 posts here)
// --------------------
// If GPS_SECRET is set in env, require header 'x-gps-secret' === GPS_SECRET
app.post("/api/gps", async (req, res) => {
  try {
    if (GPS_SECRET) {
      const secret = req.header("x-gps-secret");
      if (!secret || secret !== GPS_SECRET) {
        return res.status(401).json({ error: "Unauthorized GPS post" });
      }
    }

    const { lat, lng, timestamp } = req.body;
    if (typeof lat === "undefined" || typeof lng === "undefined") {
      return res.status(400).json({ error: "lat and lng required" });
    }

    // Accept and process immediately
    await handleData({ lat: Number(lat), lng: Number(lng), timestamp: timestamp || Date.now() }, "gsm", false);
    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ /api/gps error:", err);
    return res.status(500).json({ error: "server error" });
  }
});

// --------------------
// 🧪 Mock functions (global so toggle route can call them)
// --------------------
async function setMockHome() {
  // Wait for police stations to be loaded
  let tries = 0;
  while (policeStations.length === 0 && tries < 30) {
    console.log("⏳ Waiting for police stations to load for mock home...");
    await new Promise((r) => setTimeout(r, 1000));
    tries++;
  }
  if (policeStations.length === 0) {
    console.log("⚠️ No police stations available — mock home not set.");
    return;
  }

  const base = policeStations[0];
  if (SYSTEM_ACTIVE) {
    homeLocation = { lat: base.lat, lng: base.lng };
    initialReadings = []; // clear any previous calibration readings
    kalmanLat.x = null;
    kalmanLng.x = null;
    console.log("🏠 Mock home location fixed near:", base.name || base.stationName);
  } else {
    console.log("⛔ Mock home NOT set — system is OFF.");
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

async function startMockLoop() {
  if (_mockLoopRunning) return;
  _mockLoopRunning = true;
  console.log("✅ Starting mock GPS simulation loop");

  _mockIntervalId = setInterval(async () => {
    // only generate mock if system active and home set
    if (!SYSTEM_ACTIVE) {
      console.log("⛔ Mock skipped — system is OFF.");
      return;
    }
    if (!homeLocation) {
      console.log("⛔ Mock skipped — home not set yet.");
      return;
    }

    const point = generateRandomPointNearHome(1, 20);
    if (!point) {
      console.log("⚠️ Mock generation failed — no homeLocation");
      return;
    }

    console.log(`📍 Generated mock GPS point: (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`);
    await handleData({ lat: point.lat, lng: point.lng, timestamp: Date.now() }, "mock", true);
  }, MOCK_INTERVAL);
}

function stopMockLoop() {
  if (_mockIntervalId) {
    clearInterval(_mockIntervalId);
    _mockIntervalId = null;
    _mockLoopRunning = false;
    console.log("⛔ Mock loop stopped");
  }
}

// Start mock loop if configured to start from boot and system active
if (USE_MOCK_DATA && SYSTEM_ACTIVE) {
  setMockHome().then(() => startMockLoop());
}

// --------------------
// ✅ System Toggle route
// --------------------
app.post("/api/system/toggle", async (req, res) => {
  try {
    const { enabled } = req.body;
    const wasActive = SYSTEM_ACTIVE;
    SYSTEM_ACTIVE = !!enabled;

    console.log(`🔒 MotoGuard System is now ${SYSTEM_ACTIVE ? "ACTIVE ✅" : "INACTIVE ⛔"}`);

    if (SYSTEM_ACTIVE && !wasActive) {
      // When turned ON: reset calibration and optionally start mock loop
      homeLocation = null;
      initialReadings = [];
      kalmanLat.x = null;
      kalmanLng.x = null;
      console.log("🏠 Home reset — will be recalibrated now (system activated).");

      if (USE_MOCK_DATA) {
        await setMockHome();
        startMockLoop();
      }
    } else if (!SYSTEM_ACTIVE && wasActive) {
      // If turned OFF, stop mock simulation
      if (USE_MOCK_DATA) {
        stopMockLoop();
      }
    }

    res.json({ message: `System is now ${SYSTEM_ACTIVE ? "ACTIVE ✅" : "INACTIVE ❌"}`, active: SYSTEM_ACTIVE });
  } catch (err) {
    console.error("❌ Toggle error:", err);
    res.status(500).json({ error: "server error" });
  }
});

// optional system status
app.get("/api/system/status", (req, res) => {
  res.json({ active: SYSTEM_ACTIVE, homeLocation, latestArduinoData });
});

// --------------------
// 🌐 Other app routes (users/reports)
const userRoutes = require("./routes/users");
const reportRoutes = require("./routes/reportRoutes");
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);

// expose diagnostic endpoints
app.get("/api/arduino", (req, res) => res.json(latestArduinoData));
app.get("/api/logs", (req, res) => res.json(systemLogs.slice(-50)));
app.get("/api/notifications", (req, res) => res.json(notificationLogs.slice(-50)));

app.get("/", (req, res) => res.send("✅ Backend running + Firebase RTDB + Firestore connected"));

// --------------------
// 🚀 Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
