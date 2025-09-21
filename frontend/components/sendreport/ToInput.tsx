import React from "react";
import { View, Text, TextInput } from "react-native";

interface ToInputProps {
  to: string;
  setTo: (value: string) => void;
}

const ToInput = ({ to, setTo }: ToInputProps) => (
  <View className="mb-4">
    <Text className="text-[20px] text-gray-800 mb-1">To:</Text>
    <TextInput
      value={to}
      onChangeText={setTo}
      className="text-sm text-gray-800 border-b border-gray-400 py-0.5"
    />
  </View>
);

export default ToInput;
