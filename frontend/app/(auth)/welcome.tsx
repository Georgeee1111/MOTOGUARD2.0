import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  ImageBackground,
} from "react-native";
import { useRouter } from "expo-router";

const Welcome = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();

  return (
    <ImageBackground
      source={require("../../assets/images/BG_MG.jpg")}
      resizeMode="cover"
      className="flex-1 items-center justify-center"
    >
      {/* Dropdown (Login) */}
      <View className="absolute top-10 right-5">
        <TouchableOpacity onPress={() => setModalVisible(!modalVisible)}>
          <Text className="text-green-900 font-semibold text-[20px]">
            Login ▼
          </Text>
        </TouchableOpacity>

        <Modal
          transparent
          animationType="fade"
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <Pressable className="flex-1" onPress={() => setModalVisible(false)}>
            <View className="absolute top-14 right-5 w-48 rounded-xl bg-white shadow-lg">
              <TouchableOpacity
                className="p-3 border-b border-gray-200"
                onPress={() => {
                  setModalVisible(false);
                  router.push({
                    pathname: "/(auth)/login",
                    params: { role: "owner" },
                  });
                }}
              >
                <Text className="text-gray-700 text-[16px]">
                  Motorcycle Owner
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="p-3"
                onPress={() => {
                  setModalVisible(false);
                  router.push({
                    pathname: "/(auth)/login",
                    params: { role: "police" },
                  });
                }}
              >
                <Text className="text-gray-700 text-[16px]">
                  Police Station
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      </View>

      {/* Logo */}
      <Image
        source={require("../../assets/images/LOGO_MG.png")}
        resizeMode="contain"
        className="w-40 h-40"
      />

      {/* Title */}
      <Text className="text-4xl font-bold text-white mt-6 drop-shadow-lg">
        MotoGuard
      </Text>

      {/* Subtitle */}
      <Text className="text-white mt-2 text-lg opacity-90">
        Ride, Track, Secure
      </Text>
    </ImageBackground>
  );
};

export default Welcome;
