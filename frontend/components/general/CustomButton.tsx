import React from "react";
import { Text, TouchableOpacity, ViewStyle, TextStyle } from "react-native";

type CustomButtonProps = {
  title: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  textStyle?: TextStyle;
  leftIcon?: React.ReactNode;
};

const CustomButton = ({
  title,
  onPress,
  disabled = false,
  containerStyle,
  textStyle,
  leftIcon,
}: CustomButtonProps) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          backgroundColor: "#65A30D",
          borderRadius: 8,
          paddingVertical: 16,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
        },
        containerStyle,
      ]}
    >
      {leftIcon}
      {typeof title === "string" ? (
        <Text
          style={[
            {
              color: "#fff",
              fontSize: 20,
              fontWeight: "600",
              textAlign: "center",
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
      ) : (
        title
      )}
    </TouchableOpacity>
  );
};

export default CustomButton;
