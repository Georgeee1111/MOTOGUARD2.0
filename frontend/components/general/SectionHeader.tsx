import React from "react";
import { Text, View } from "react-native";

const SectionHeader = ({ title }: { title: string }) => {
  return (
    <View className="bg-green-900 py-4 px-6">
      <Text className="text-white text-lg font-semibold">{title}</Text>
    </View>
  );
};

export default SectionHeader;
