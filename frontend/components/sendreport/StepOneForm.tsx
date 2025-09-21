import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TextInputProps,
} from "react-native";

export type Field = {
  label: string;
  value: string;
  setter: (text: string) => void;
  keyboardType?: TextInputProps["keyboardType"];
};

type StepOneFormProps = {
  fields: Field[];
  description: string;
  setDescription: (text: string) => void;
  onNext: () => void;
};

const StepOneForm: React.FC<StepOneFormProps> = ({
  fields,
  description,
  setDescription,
  onNext,
}) => {
  return (
    <>
      <View className="bg-container shadow-md rounded-lg p-4">
        {fields.map((field, index) => (
          <View key={index} className="flex-row items-center mb-3 space-x-1">
            <Text className="text-sm text-gray-800">{field.label}</Text>
            <TextInput
              value={field.value}
              onChangeText={field.setter}
              keyboardType={field.keyboardType || "default"}
              className="flex-1 border-b border-gray-300 text-sm text-gray-700 py-0.5 ml-4"
            />
          </View>
        ))}
      </View>

      <View className="mt-4 bg-container shadow-md rounded-lg p-3">
        <Text className="mb-1 text-sm text-gray-800">
          Describe what happened
        </Text>
        <TextInput
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          className="text-[14px] text-gray-700"
          value={description}
          onChangeText={setDescription}
          style={{ minHeight: 120 }}
        />
      </View>

      <TouchableOpacity
        className="mt-6 bg-lime-700 py-3 rounded-md items-center"
        onPress={onNext}
      >
        <Text className="text-white text-base">Next</Text>
      </TouchableOpacity>
    </>
  );
};

export default StepOneForm;
