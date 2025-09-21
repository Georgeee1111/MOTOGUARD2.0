import React from "react";
import { View } from "react-native";

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
}

const CardContainer: React.FC<CardContainerProps> = ({
  children,
  className = "",
}) => {
  return (
    <View className={`border-b border-gray-300 ${className}`}>
      <View className="px-4 py-4">{children}</View>
    </View>
  );
};

export default CardContainer;
