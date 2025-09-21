import { View, Text, Image, TouchableOpacity } from "react-native";
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useSegments } from "expo-router";
import { safePush } from "@/utils/navigation";
import { NavItemProps } from "@/interfaces/routes/Navigation";

interface TopNavProps {
  title: string;
  navItems: NavItemProps[];
}

export const TopNav: React.FC<TopNavProps> = ({ title, navItems }) => {
  return (
    <View className="bg-green-900 px-4 pt-10 pb-4">
      <View className="flex-row items-center">
        <TouchableOpacity>
          <Ionicons name="menu" size={28} color="#fff" />
        </TouchableOpacity>

        <Text className="text-white text-lg font-semibold ml-5">{title}</Text>
      </View>

      <View className="flex-row justify-around mt-6">
        {navItems.map((item) => (
          <NavItem
            key={item.route}
            icon={item.icon}
            label={item.label}
            route={item.route}
          />
        ))}
      </View>
    </View>
  );
};

const NavItem = ({ icon, label, route }: NavItemProps) => {
  const router = useRouter();
  const segments = useSegments();

  const lastSegment = segments[segments.length - 1];
  const routeSegment = route.split("/").pop();
  const isActive = lastSegment === routeSegment;

  const onPress = React.useCallback(() => {
    safePush(router, route);
  }, [route, router]);

  return (
    <TouchableOpacity className="items-center" onPress={onPress}>
      <Image
        source={icon}
        className="w-6 h-6"
        resizeMode="contain"
        style={{
          opacity: isActive ? 1 : 0.5,
          tintColor: isActive ? "white" : "gray",
        }}
      />
      <Text
        className={`text-xs mt-1 ${isActive ? "text-white" : "text-gray-400"}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};
