import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

interface StepTwoProps {
  agree: boolean;
  setAgree: (value: boolean) => void;
  onSubmit: () => void;
  onBack: () => void;
}

const StepTwoUpload = ({ agree, setAgree, onSubmit, onBack }: StepTwoProps) => (
  <View>
    {[
      "LTO Official Receipt and Certificate of Registration",
      "any of your Valid ID",
    ].map((label, i) => (
      <TouchableOpacity
        key={i}
        className="shadow-md rounded-xl p-4 mb-4"
        style={{ backgroundColor: "#F4F2F2" }}
        onPress={() => {}}
      >
        <Text className="text-center text-sm text-gray-800">
          Upload {label}
        </Text>
        <Text className="text-center text-blue-500 mt-2">Add file</Text>
      </TouchableOpacity>
    ))}

    <View className="flex-row items-start mb-6">
      <TouchableOpacity
        onPress={() => setAgree(!agree)}
        className="w-5 h-5 border border-gray-700 mr-2 justify-center items-center mt-1"
      >
        {agree && <View className="w-3 h-3 bg-gray-800" />}
      </TouchableOpacity>
      <Text className="text-xs text-gray-700 flex-1">
        “ I attest the information provided above are true.”
      </Text>
    </View>

    <TouchableOpacity
      className="bg-[#7A9D54] py-3 rounded-md items-center"
      onPress={onSubmit}
    >
      <Text className="text-white text-base">Send Report</Text>
    </TouchableOpacity>

    <TouchableOpacity
      className="mt-4 py-3 rounded-md items-center border border-[#7A9D54]"
      onPress={onBack}
    >
      <Text className="text-[#7A9D54] text-base">Back</Text>
    </TouchableOpacity>
  </View>
);

export default StepTwoUpload;
