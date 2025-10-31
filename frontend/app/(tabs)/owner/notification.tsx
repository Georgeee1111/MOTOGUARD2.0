import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import CardContainer from "@/components/general/CardContainer";

const Notification = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<number | null>(null); // ✅ Change here

  const fetchNotifications = async () => {
    try {
      const response = await fetch("http://192.168.1.8:5000/api/notifications");
      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error("❌ Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  useEffect(() => {
    fetchNotifications();

    // 🔄 Poll every 5 seconds
    intervalRef.current = setInterval(() => {
      fetchNotifications();
    }, 5000);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#000" />
        <Text className="text-gray-500 mt-2">Loading notifications...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {notifications.length === 0 ? (
        <View className="p-4">
          <Text className="text-gray-500 text-center">
            No notifications yet.
          </Text>
        </View>
      ) : (
        notifications.map((item, index) => (
          <CardContainer key={index}>
            <Text className="text-gray-600 text-sm font-medium">
              {item.number} at
            </Text>

            {!item.extra ? (
              <View className="flex-row justify-between items-center mt-1">
                <Text className="text-gray-700 font-semibold">
                  {item.message}
                </Text>
                <Text className="text-gray-400 text-xs">{item.date}</Text>
              </View>
            ) : (
              <>
                <Text className="text-gray-700 font-semibold mt-1">
                  {item.message}
                </Text>
                <View className="flex-row justify-between mt-1">
                  <Text className="text-gray-700 text-sm">{item.extra}</Text>
                  <Text className="text-gray-400 text-xs">{item.date}</Text>
                </View>
              </>
            )}
          </CardContainer>
        ))
      )}
    </ScrollView>
  );
};

export default Notification;
