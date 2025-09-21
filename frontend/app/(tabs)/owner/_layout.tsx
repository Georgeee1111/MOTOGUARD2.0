import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";
import { TopNav } from "@/components/tab/TopNav";
import { icons } from "@/constants/icons";
import { ROUTES } from "@/interfaces/routes/Navigation";
import { firebaseAuth } from "@/firebase/firebaseClient";
import { getUserProfile } from "@/lib/api";

const _layout = () => {
  const [fullName, setFullName] = useState("User");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const user = firebaseAuth.currentUser;
        console.log("Firebase user:", user);

        if (user) {
          const profile = await getUserProfile(user.uid);
          console.log("Fetched profile:", profile);

          setFullName(profile?.fullName || "User");
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserName();
  }, []);

  return (
    <View className="flex-1 bg-white">
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

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            display: "none",
          },
        }}
      >
        <Tabs.Screen name="location" />
        <Tabs.Screen name="notification" />
        <Tabs.Screen name="sendreport" />
        <Tabs.Screen name="reportlogs" />
      </Tabs>
    </View>
  );
};

export default _layout;
