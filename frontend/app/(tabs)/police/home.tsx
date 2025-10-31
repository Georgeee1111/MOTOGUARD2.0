import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import CardContainer from "@/components/general/CardContainer";
import { getUnreadReports } from "@/lib/api";

interface Report {
  id: string;
  owner: string;
  plate: string;
  brand: string;
  status: string;
  timestamp: string | null;
}

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await getUnreadReports();
        setReports(res.reports || []);
      } catch (error) {
        console.error("❌ Error fetching unread reports:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUnread();
  }, []);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="red" />
      </View>
    );
  }

  const hasUnread = reports.length > 0;

  return (
    <View className="flex-1 bg-white">
      {/* 👇 Remove padding and use noPadding prop */}
      <CardContainer noPadding>
        <View className="items-center py-5">
          <View className="flex-row items-center mb-1">
            <FontAwesome
              name={hasUnread ? "exclamation-circle" : "check-circle"}
              size={22}
              color={hasUnread ? "red" : "#22C55E"} // red or green
            />
            <Text className="text-base font-semibold text-black ml-2">
              {reports.length} New Complaint Report
              {reports.length !== 1 ? "s" : ""} Received
            </Text>
          </View>

          <Pressable onPress={() => router.push("/police/notification")}>
            <Text className="text-blue-600 underline text-sm mt-1">
              View full notification
            </Text>
          </Pressable>
        </View>
      </CardContainer>

      <Text className="text-xs text-gray-700 text-center mt-5 px-4">
        {hasUnread
          ? "You are assigned to review and verify the submitted complaint."
          : "You’re all caught up! No new complaint reports at the moment."}
      </Text>
    </View>
  );
}
