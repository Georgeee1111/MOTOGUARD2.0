import { View } from "react-native";
import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { TopNav } from "@/components/tab/TopNav";
import { icons } from "@/constants/icons";
import { ROUTES } from "@/interfaces/routes/Navigation";
import { firebaseAuth } from "@/firebase/firebaseClient";
import { getUserProfile } from "@/lib/api";

export default function PoliceTabLayout() {
  const [stationName, setStationName] = useState("Loading...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStationName = async () => {
      try {
        const user = firebaseAuth.currentUser;
        if (user) {
          const profile = await getUserProfile(user.uid);
          // Show stationName only if role is police; otherwise fallback to "Station"
          if (profile.role === "police" && profile.stationName) {
            setStationName(profile.stationName);
          } else {
            setStationName("Station");
          }
        } else {
          setStationName("Station");
        }
      } catch (error) {
        console.error("Error fetching station profile:", error);
        setStationName("Station");
      } finally {
        setLoading(false);
      }
    };

    fetchStationName();
  }, []);

  return (
    <View className="flex-1 bg-white">
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

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            display: "none",
          },
        }}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="notification" />
        <Tabs.Screen name="report" />
        <Tabs.Screen name="archive" />
      </Tabs>
    </View>
  );
}
