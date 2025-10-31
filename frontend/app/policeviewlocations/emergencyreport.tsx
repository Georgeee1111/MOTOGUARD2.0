import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import CardContainer from "@/components/general/CardContainer";
import { router } from "expo-router";

export default function EmergencyReportScreen() {
  const { distance, lat, lng, message, timestamp, station_name } =
    useLocalSearchParams();

  return (
    <ScrollView className="flex-1 bg-white p-4">
      <CardContainer className="mb-4">
        <Text className="text-xl font-bold text-red-600 mb-3">
          🚨 Emergency Report Details
        </Text>

        <Text className="text-sm text-black mb-1">
          <Text className="font-semibold">Station:</Text> {station_name}
        </Text>
        <Text className="text-sm text-black mb-1">
          <Text className="font-semibold">Distance:</Text> {distance} meters
        </Text>
        <Text className="text-sm text-black mb-1">
          <Text className="font-semibold">Timestamp:</Text> {timestamp}
        </Text>

        <View className="flex-row items-center mb-1">
          <Text className="text-sm text-black">Location: </Text>
          <Pressable
            onPress={() =>
              router.push("/policeviewlocations/policeviewlocation")
            }
          >
            <Text className="text-blue-600 underline">View location</Text>
          </Pressable>
        </View>

        <View className="mt-3 border-t border-gray-200 pt-3">
          <Text className="text-sm font-semibold text-black mb-1">
            Message:
          </Text>
          <Text className="text-sm text-black">{message}</Text>
        </View>
      </CardContainer>
    </ScrollView>
  );
}
