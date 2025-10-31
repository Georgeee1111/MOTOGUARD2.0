import { View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useState, useRef } from "react";
import { TopNav } from "@/components/tab/TopNav";
import { icons } from "@/constants/icons";
import { ROUTES } from "@/interfaces/routes/Navigation";
import { firebaseAuth, db } from "@/firebase/firebaseClient";
import { getUserProfile } from "@/lib/api";
import { EmergencyReportModal } from "@/components/general/EmergencyReportModal";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

export default function PoliceTabLayout() {
  const [stationName, setStationName] = useState("Loading...");
  const [stationContactNumber, setStationContactNumber] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState<any>(null);

  const lastReportIdRef = useRef<string | null>(null);
  const lastAlertTimeRef = useRef<number>(0);
  const cooldownMs = 15000; // ⏱️ 15-second cooldown
  const router = useRouter();

  // 🔹 Fetch station profile
  useEffect(() => {
    const fetchStationProfile = async () => {
      try {
        const user = firebaseAuth.currentUser;
        if (user) {
          const profile = await getUserProfile(user.uid);
          if (profile.role === "police") {
            setStationName(profile.stationName || "Station");
            setStationContactNumber(profile.contactNumber || null);
          } else {
            setStationName("Station");
          }
        }
      } catch (error) {
        console.error("Error fetching station profile:", error);
        setStationName("Station");
      } finally {
        setLoading(false);
      }
    };

    fetchStationProfile();
  }, []);

  // 🔹 Listen to emergency reports (≥15 meters only)
  useEffect(() => {
    if (!stationContactNumber) return;

    const q = query(
      collection(db, "auto_reports"),
      where("contact_number", "==", stationContactNumber),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== "added") return;

        const report = change.doc;
        const data = report.data();
        const distance = data.distance || 0;

        // ⚠️ Skip non-emergency distances
        if (distance < 15) return;

        // 🚫 Prevent duplicate report alerts
        if (lastReportIdRef.current === report.id) return;
        lastReportIdRef.current = report.id;

        // 🧊 Cooldown to prevent spam
        const now = Date.now();
        if (now - lastAlertTimeRef.current < cooldownMs) return;
        lastAlertTimeRef.current = now;

        console.log("🚨 Emergency report received:", data);

        // 🟥 Show Emergency Modal
        setModalData({
          type: "emergency",
          title: "Emergency Alert",
          message: "Vehicle Theft Report Received",
          details: {
            "🚓 Station": data.station_name || "Unknown",
            "🏍️ Distance": `${distance.toFixed(2)} meters`,
            "📞 Contact": data.contact_number || "N/A",
            "🕒 Time":
              data.timestamp?.toDate?.()?.toLocaleString?.() || "Unknown",
          },
          fullReport: data,
        });

        setModalVisible(true);
      });
    });

    return () => unsubscribe();
  }, [stationContactNumber]);

  return (
    <View className="flex-1 bg-white">
      {/* 🔹 Top Navigation */}
      <TopNav
        title={loading ? "Loading..." : stationName}
        navItems={[
          { icon: icons.home, label: "Home", route: ROUTES.POLICE_HOME },
          {
            icon: icons.notification,
            label: "Notification",
            route: ROUTES.POLICE_NOTIFICATION,
          },
          {
            icon: icons.sendreport,
            label: "Report",
            route: ROUTES.POLICE_REPORT,
          },
          {
            icon: icons.reportlogs,
            label: "Archive",
            route: ROUTES.POLICE_ARCHIVE,
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
        <Tabs.Screen name="home" />
        <Tabs.Screen name="notification" />
        <Tabs.Screen name="report" />
        <Tabs.Screen name="archive" />
      </Tabs>

      {/* 🚨 Emergency Modal */}
      {modalVisible && modalData && (
        <EmergencyReportModal
          visible={modalVisible}
          type="emergency"
          title={modalData.title}
          message={modalData.message}
          details={modalData.details}
          onClose={() => setModalVisible(false)}
          onView={() => {
            setModalVisible(false);
            const r = modalData.fullReport;
            if (r) {
              router.push({
                pathname: "/policeviewlocations/emergencyreport",
                params: {
                  station_name: r.station_name,
                  distance: r.distance,
                  lat: r.lat,
                  lng: r.lng,
                  message: r.message,
                  timestamp: r.timestamp?.toDate?.()?.toISOString(),
                },
              });
            }
          }}
        />
      )}
    </View>
  );
}
