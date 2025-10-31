import React, { useEffect, useState, useRef } from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";
import { TopNav } from "@/components/tab/TopNav";
import { icons } from "@/constants/icons";
import { ROUTES } from "@/interfaces/routes/Navigation";
import { firebaseAuth, db, rtdb } from "@/firebase/firebaseClient";
import { getUserProfile } from "@/lib/api";
import { EmergencyReportModal } from "@/components/general/EmergencyReportModal";
import {
  onSnapshot,
  collection,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { ref as rtdbRef, onValue } from "firebase/database";

// 🔹 Distance thresholds (in meters)
const SAFE_ZONE_MAX = 10; // < 10m = Safe
const WARNING_ZONE_MIN = 11; // 11–14m = Warning
const WARNING_ZONE_MAX = 14;
const EMERGENCY_THRESHOLD = 15; // > 15m = Emergency

// 🔹 Cooldowns
const COOLDOWN_WARNING_MS = 10000; // 10 seconds
const COOLDOWN_EMERGENCY_MS = 15000; // 15 seconds

const OwnerLayout = () => {
  const [fullName, setFullName] = useState("User");
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState<any>(null);
  const [alertType, setAlertType] = useState<"safe" | "warning" | "emergency">(
    "safe"
  );

  // 🔸 Refs for cooldowns & avoiding stale state
  const lastWarningRef = useRef<number>(0);
  const lastEmergencyRef = useRef<number>(0);
  const alertTypeRef = useRef(alertType);

  useEffect(() => {
    alertTypeRef.current = alertType;
  }, [alertType]);

  // 🔹 Fetch owner profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const user = firebaseAuth.currentUser;
        if (user) {
          const profile = await getUserProfile(user.uid);
          setFullName(profile.fullName || "User");
        }
      } catch (err) {
        console.error("❌ Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // 🔹 Firestore listener — emergencies (> 15m)
  useEffect(() => {
    const reportsRef = collection(db, "auto_reports");
    const q = query(reportsRef, orderBy("timestamp", "desc"), limit(1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== "added") return;

        const report = change.doc.data();
        const distance = report.distance || 0;
        const stationName = report.station_name || "Unknown";
        const now = Date.now();

        // 🟢 Safe zone
        if (distance < SAFE_ZONE_MAX) {
          if (alertTypeRef.current !== "safe") {
            console.log(
              "✅ Firestore: Back to safe zone — resetting cooldowns."
            );
            setAlertType("safe");
            setModalVisible(false);
          }

          // ✅ Reset cooldowns for both warning & emergency when safe
          lastWarningRef.current = 0;
          lastEmergencyRef.current = 0;
          return;
        }

        // 🚨 Emergency (>15m)
        if (distance > EMERGENCY_THRESHOLD) {
          if (now - lastEmergencyRef.current < COOLDOWN_EMERGENCY_MS) return;
          lastEmergencyRef.current = now;

          console.log("🚨 Emergency triggered (>15m)");
          setAlertType("emergency");
          setModalData({
            title: "Emergency",
            message: "Emergency detected! Report has been sent to authorities.",
            details: {
              "📍 Station": stationName,
              "🏍️ Distance": `${distance.toFixed(2)} meters`,
            },
          });
          setModalVisible(true);
        }
      });
    });

    return () => unsubscribe();
  }, []);

  // 🔹 RTDB listener — handle warning/safe zones
  useEffect(() => {
    const deviceRef = rtdbRef(rtdb, "device1/history");

    const unsubscribe = onValue(deviceRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      // ✅ Get latest history entry
      const keys = Object.keys(data);
      const latestKey = keys[keys.length - 1];
      const latestData = data[latestKey];
      if (!latestData) return;

      const distance = latestData.distance ?? 0;
      const stationName = latestData.station_name || "Unknown";
      const now = Date.now();

      console.log(`📏 Current distance: ${distance.toFixed(2)}m`);

      // 🚫 Ignore emergencies (handled by Firestore)
      if (distance > EMERGENCY_THRESHOLD) return;

      // 🟡 Warning zone (11–14m)
      if (distance >= WARNING_ZONE_MIN && distance <= WARNING_ZONE_MAX) {
        if (now - lastWarningRef.current >= COOLDOWN_WARNING_MS) {
          lastWarningRef.current = now;

          console.log("⚠️ Showing WARNING modal (11–14m)");
          setAlertType("warning");
          setModalData({
            title: "Warning",
            message: "Movement detected near the danger threshold!",
            details: {
              "📍 Station": stationName,
              "🏍️ Distance": `${distance.toFixed(2)} meters`,
            },
          });
          setModalVisible(true);
        }
        return;
      }

      // 🟢 Safe zone (<10m)
      if (distance < SAFE_ZONE_MAX) {
        if (alertTypeRef.current !== "safe") {
          console.log(
            "✅ Back to safe zone — closing modal and resetting all cooldowns."
          );
          setAlertType("safe");
          setModalVisible(false);
        }

        // ✅ Reset cooldowns for both warning & emergency
        lastWarningRef.current = 0;
        lastEmergencyRef.current = 0;

        return;
      }

      // 🟠 Transition (10–11 or 14–15)
      if (
        (distance >= SAFE_ZONE_MAX && distance < WARNING_ZONE_MIN) ||
        (distance > WARNING_ZONE_MAX && distance < EMERGENCY_THRESHOLD)
      ) {
        if (alertTypeRef.current !== "safe") {
          console.log("ℹ️ Transition zone — closing any active modal.");
          setModalVisible(false);
          setAlertType("safe");
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <View className="flex-1 bg-white">
      {/* 🔹 Top Navigation */}
      <TopNav
        title={loading ? "Loading..." : fullName}
        navItems={[
          { icon: icons.location, label: "Location", route: ROUTES.LOCATION },
          {
            icon: icons.notification,
            label: "Notification",
            route: ROUTES.NOTIFICATION,
          },
          {
            icon: icons.sendreport,
            label: "Send Report",
            route: ROUTES.SENDREPORT,
          },
          {
            icon: icons.reportlogs,
            label: "Report Logs",
            route: ROUTES.REPORTLOGS,
          },
        ]}
      />

      {/* 🔹 Hidden Tabs */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="location" />
        <Tabs.Screen name="notification" />
        <Tabs.Screen name="sendreport" />
        <Tabs.Screen name="reportlogs" />
      </Tabs>

      {/* 🔹 Show modal only when not safe */}
      {modalVisible && modalData && alertType !== "safe" && (
        <EmergencyReportModal
          visible={modalVisible}
          type={alertType}
          title={modalData.title}
          message={modalData.message}
          details={modalData.details || {}}
          onClose={() => {
            console.log("🧹 Modal closed manually by user.");
            setModalVisible(false);
            setAlertType("safe");

            // ✅ Reset cooldowns when closed manually
            lastWarningRef.current = 0;
            lastEmergencyRef.current = 0;
          }}
        />
      )}
    </View>
  );
};

export default OwnerLayout;
