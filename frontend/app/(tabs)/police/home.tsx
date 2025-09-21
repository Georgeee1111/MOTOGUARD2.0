import React from "react";
import { View, Text, Pressable } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import CardContainer from "@/components/general/CardContainer";

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-white">
      <CardContainer>
        <View className="items-center">
          <View className="flex-row items-center">
            <FontAwesome name="exclamation-circle" size={20} color="red" />
            <Text className="text-base font-medium text-black ml-2">
              New Complaint Report Received
            </Text>
          </View>

          <Pressable>
            <Text className="text-blue-600 underline text-sm mt-1">
              View full notification
            </Text>
          </Pressable>
        </View>
      </CardContainer>

      <Text className="text-xs text-black text-center mt-4 px-4">
        You are assigned to review and verify the submitted complaint.
      </Text>
    </View>
  );
}
