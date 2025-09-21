import React from "react";
import { View, Text, ScrollView } from "react-native";
import CardContainer from "@/components/general/CardContainer";
const notification = () => {
  const mockData = [
    {
      number: "+639204456898",
      message: "Vibration Detected",
      date: "01/30/2024",
    },
    {
      number: "+639204456898",
      message: "Movement Detected",
      extra: "Distance at: 10m",
      date: "05/20/2025",
    },
  ];

  return (
    <ScrollView className="flex-1 bg-white">
      {mockData.map((item, index) => (
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
      ))}
    </ScrollView>
  );
};

export default notification;
