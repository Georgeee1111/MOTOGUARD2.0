import React from "react";
import { Text, TouchableOpacity } from "react-native";

const PrimaryButton = ({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity className="bg-lime-600 py-4 rounded" onPress={onPress}>
      <Text className="text-white text-center text-base font-semibold">
        {title}
      </Text>
    </TouchableOpacity>
  );
};

export default PrimaryButton;
