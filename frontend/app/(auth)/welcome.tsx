import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";

const welcome = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <View className="absolute top-10 right-5">
        <TouchableOpacity onPress={() => setModalVisible(!modalVisible)}>
          <Text className="text-green-800 font-bold text-[20px]">Login ▼</Text>
        </TouchableOpacity>

        <Modal
          transparent
          animationType="fade"
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <Pressable className="flex-1" onPress={() => setModalVisible(false)}>
            <View className="absolute top-14 right-5 w-48 rounded-xl bg-container shadow-md">
              <TouchableOpacity
                className="p-3"
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

      <Image
        source={require("../../assets/images/MOTOGUARD.png")}
        resizeMode="contain"
      />

      <Text className="text-3xl font-bold text-green-800 mt-[16px] text-[38px]">
        MotoGuard
      </Text>
      <Text className="text-gray-600 mt-[16px] text-[20px]">
        Ride, Track, Secure
      </Text>
    </View>
  );
};

export default welcome;
