import React from "react";
import { View } from "react-native";

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

const CardContainer: React.FC<CardContainerProps> = ({
  children,
  className = "",
  noPadding = false,
}) => {
  return (
    <View className={`border-b border-gray-300 ${className}`}>
      <View className={noPadding ? "" : "px-4 py-4"}>{children}</View>
    </View>
  );
};

export default CardContainer;
