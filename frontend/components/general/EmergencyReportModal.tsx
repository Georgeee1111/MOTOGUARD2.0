import React from "react";
import { View, Text, Modal, Pressable } from "react-native";

interface AlertDetails {
  [key: string]: any;
}

interface Props {
  visible: boolean;
  type?: "safe" | "warning" | "emergency";
  title?: string;
  color?: string;
  message: string;
  details?: AlertDetails;
  onClose: () => void;
  onView?: () => void;
}

export const EmergencyReportModal = ({
  visible,
  type = "emergency",
  title,
  color,
  message,
  details = {},
  onClose,
  onView,
}: Props) => {
  if (!visible) return null;

  const isEmergency = type === "emergency";
  const headerColor =
    color || (isEmergency ? "text-red-600" : "text-yellow-600");
  const headerTitle =
    title ||
    (isEmergency ? "🚨 Vehicle Theft Alert!" : "⚠️ Movement Detected!");

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-center items-center bg-black/60">
        <View className="bg-white w-11/12 rounded-2xl p-6">
          {/* Title */}
          <Text className={`text-xl font-bold mb-3 ${headerColor}`}>
            {headerTitle}
          </Text>

          {/* Message */}
          <Text className="text-gray-700 mb-2">{message}</Text>

          {/* Optional dynamic details */}
          {Object.keys(details).length > 0 && (
            <View className="mt-2">
              {Object.entries(details).map(([key, value]) => (
                <Text key={key} className="text-gray-600">
                  {key}:{" "}
                  <Text className="font-semibold">
                    {typeof value === "number"
                      ? value.toFixed?.(2) ?? value
                      : String(value)}
                  </Text>
                </Text>
              ))}
            </View>
          )}

          {/* Actions */}
          <View className="mt-6 flex-row justify-end gap-x-6">
            <Pressable onPress={onClose}>
              <Text className="text-gray-500 font-semibold">Dismiss</Text>
            </Pressable>
            {onView && (
              <Pressable onPress={onView}>
                <Text
                  className={`font-semibold ${
                    isEmergency ? "text-red-600" : "text-blue-600"
                  }`}
                >
                  {isEmergency ? "View Emergency" : "View Details"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};
