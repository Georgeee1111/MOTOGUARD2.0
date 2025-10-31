import {
  View,
  Image,
  Platform,
  Alert,
  Pressable,
  Text,
  ImageBackground,
} from "react-native";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import FormInput from "@/components/general/FormInput";
import CustomButton from "@/components/general/CustomButton";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Formik } from "formik";
import { loginValidationSchema } from "@/validationschema/validationSchemas";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { LoginFormValues } from "@/interfaces/login/Login";
import { firebaseAuth } from "@/firebase/firebaseClient";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getEmailByUsername, getUserProfile } from "@/lib/api";
import { FontAwesome } from "@expo/vector-icons";

const Login = () => {
  const router = useRouter();
  const rawRole = useLocalSearchParams().role;
  const role = Array.isArray(rawRole) ? rawRole[0] : rawRole;
  const [showPassword, setShowPassword] = React.useState(false);

  const getRoutePath = (
    role: string | undefined,
    action: "login" | "signup"
  ) => {
    if (role === "police") {
      return action === "login"
        ? "/(tabs)/police/home"
        : "/(auth)/stationsignup";
    } else {
      return action === "login"
        ? "/(tabs)/owner/location"
        : "/(auth)/usersignup";
    }
  };

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  const handleSignUpPress = () => router.push(getRoutePath(role, "signup"));

  const handleLogin = async (values: LoginFormValues) => {
    try {
      const email = await getEmailByUsername(values.username);
      if (!email) {
        Alert.alert("Login Failed", "Username not found");
        return;
      }

      const userCredential = await signInWithEmailAndPassword(
        firebaseAuth,
        email,
        values.password
      );

      const profile = await getUserProfile(userCredential.user.uid);
      if (!profile?.role) {
        Alert.alert("Login Failed", "User role not found");
        return;
      }

      router.push(getRoutePath(profile.role, "login"));
    } catch (error: any) {
      console.error("Login Error:", error);
      const errorMessage =
        error?.code === "auth/user-not-found"
          ? "User not found"
          : error?.code === "auth/wrong-password"
          ? "Incorrect password"
          : "Login failed. Please check your credentials";
      Alert.alert("Login Failed", errorMessage);
    }
  };

  return (
    <SafeAreaView className="flex-1" edges={["top", "left", "right"]}>
      <ImageBackground
        source={require("../../assets/images/BG_MG.jpg")}
        resizeMode="cover"
        className="flex-1 justify-center"
      >
        <KeyboardAwareScrollView
          enableOnAndroid
          enableAutomaticScroll
          extraScrollHeight={Platform.OS === "ios" ? 80 : 100}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingBottom: 20,
          }}
        >
          <View className="items-center mb-8">
            <Image
              source={require("../../assets/images/LOGO_MG.png")}
              resizeMode="contain"
              className="w-32 h-32"
            />
          </View>

          <Formik<LoginFormValues>
            initialValues={{ username: "", password: "" }}
            validationSchema={loginValidationSchema}
            onSubmit={handleLogin}
          >
            {({
              handleChange,
              handleBlur,
              handleSubmit,
              values,
              errors,
              touched,
              isValid,
            }) => (
              <View className="px-6 space-y-3">
                {/* Username Input */}
                <FormInput
                  placeholder="Username"
                  value={values.username}
                  onChangeText={handleChange("username")}
                  onBlur={handleBlur("username")}
                  error={
                    touched.username && errors.username ? errors.username : ""
                  }
                  placeholderColor="#E5E7EB"
                  textColor="#FFFFFF"
                  inputStyle={{ fontSize: 18 }}
                />

                {/* Password Input */}
                <FormInput
                  placeholder="Password"
                  secureTextEntry={!showPassword}
                  value={values.password}
                  onChangeText={handleChange("password")}
                  onBlur={handleBlur("password")}
                  error={
                    touched.password && errors.password ? errors.password : ""
                  }
                  placeholderColor="#E5E7EB"
                  textColor="#FFFFFF"
                  rightIcon={
                    <Pressable onPress={togglePasswordVisibility}>
                      <FontAwesome
                        name={showPassword ? "eye-slash" : "eye"}
                        size={20}
                        color="#E5E7EB"
                      />
                    </Pressable>
                  }
                />

                {/* ✅ Centered Sign In Button */}
                <View style={{ alignItems: "center", marginTop: 40 }}>
                  <CustomButton
                    title="Sign in"
                    onPress={handleSubmit as () => void}
                    disabled={!isValid}
                    containerStyle={{
                      width: "60%",
                      backgroundColor: isValid ? "#65A30D" : "#A5ADAF",
                      paddingVertical: 12,
                      borderRadius: 6,
                      alignSelf: "center",
                    }}
                    textStyle={{
                      color: "white",
                      fontSize: 16,
                      fontWeight: "600",
                      textAlign: "center",
                    }}
                  />
                </View>

                {/* Sign Up Link */}
                <View className="items-center mt-4">
                  <Text className="text-white text-base">
                    Not registered yet?{" "}
                    <Text
                      className="text-white underline"
                      onPress={handleSignUpPress}
                    >
                      Sign up
                    </Text>
                  </Text>
                </View>
              </View>
            )}
          </Formik>
        </KeyboardAwareScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
};

export default Login;
