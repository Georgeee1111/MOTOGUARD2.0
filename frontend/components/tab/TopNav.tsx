import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
} from "react-native";
import React, { useState, useRef, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useSegments } from "expo-router";
import { safePush } from "@/utils/navigation";
import { NavItemProps } from "@/interfaces/routes/Navigation";
import { firebaseAuth, db } from "@/firebase/firebaseClient";
import { doc, getDoc } from "firebase/firestore";
import { toggleSystem } from "@/lib/api";
interface TopNavProps {
  title: string;
  navItems: NavItemProps[];
}

export const TopNav: React.FC<TopNavProps> = ({ title, navItems }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const slideAnim = useRef(
    new Animated.Value(-Dimensions.get("window").width * 0.7)
  ).current;

  const router = useRouter();

  // ✅ System toggle state
  const [systemEnabled, setSystemEnabled] = useState<boolean>(false);

  // User state
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");

  // Fetch current user info
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const user = firebaseAuth.currentUser;
        if (user) {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserName(data.fullName || data.stationName || "");
            setUserEmail(data.email || user.email || "");
            setUserRole(data.role || "");
          }
        }
      } catch (error) {
        console.log("Error fetching user info:", error);
      }
    };

    fetchUserInfo();
  }, []);

  // Toggle the hamburger menu
  const toggleModal = () => {
    if (isModalVisible) {
      Animated.timing(slideAnim, {
        toValue: -Dimensions.get("window").width * 0.7,
        duration: 300,
        useNativeDriver: false,
      }).start(() => setIsModalVisible(false));
    } else {
      setIsModalVisible(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  // Handle Edit Profile navigation
  const handleEditProfile = () => {
    toggleModal(); // close the menu first

    if (userRole === "police") {
      router.push("/editprofile/StationEditInfo");
    } else if (userRole === "owner") {
      router.push("/editprofile/OwnerEditInformation");
    } else {
      console.warn("Unknown role or not logged in");
    }
  };

  return (
    <View className="bg-green-900 px-4 pt-10 pb-4">
      <View className="flex-row items-center">
        <TouchableOpacity onPress={toggleModal}>
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

      {/* Slide-in Modal */}
      <Modal transparent visible={isModalVisible} animationType="none">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={toggleModal}
        />
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: Dimensions.get("window").width * 0.7,
            backgroundColor: "#FFFFFF",
            paddingTop: 60,
            paddingHorizontal: 20,
            transform: [{ translateX: slideAnim }],
          }}
        >
          {/* User Info */}
          <View className="mb-8">
            <Text className="text-black text-xl font-bold mb-1">
              {userName}
            </Text>
            <Text className="text-gray-700">{userEmail}</Text>
          </View>

          {/* Edit Profile */}
          <TouchableOpacity
            className="flex-row items-center mb-6"
            onPress={handleEditProfile}
          >
            <Ionicons name="create-outline" size={24} color="black" />
            <Text className="text-black text-base ml-4">Edit Profile</Text>
          </TouchableOpacity>

          {/* Police Station */}
          <TouchableOpacity
            className="flex-row items-center mb-6"
            onPress={() => {
              toggleModal();
              router.push("/policestations/policestation");
            }}
          >
            <Ionicons name="home-outline" size={24} color="black" />
            <Text className="text-black text-base ml-4">Police Station</Text>
          </TouchableOpacity>

          {/* ✅ NEW: MotoGuard On / Off Button */}
          <TouchableOpacity
            className="flex-row items-center mb-6"
            onPress={async () => {
              try {
                const newState = !systemEnabled;
                setSystemEnabled(newState);

                const result = await toggleSystem(newState);
                console.log("Toggle result:", result.message);

                toggleModal();
              } catch (error) {
                console.log("Toggle error:", error);
              }
            }}
          >
            <Ionicons
              name={systemEnabled ? "lock-open-outline" : "lock-closed-outline"}
              size={24}
              color={systemEnabled ? "green" : "red"}
            />
            <Text className="text-black text-base ml-4">
              {systemEnabled ? "System Active" : "System Inactive"}
            </Text>
          </TouchableOpacity>

          {/* Spacer */}
          <View className="flex-1" />

          {/* Logout */}
          <TouchableOpacity className="flex-row items-center mb-10">
            <Ionicons name="log-out-outline" size={24} color="#FF4D4D" />
            <Text className="text-red-500 text-base ml-4">Logout</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
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
