import { View, Image, Platform, Alert } from "react-native";
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

const Login = () => {
  const router = useRouter();
  const rawRole = useLocalSearchParams().role;
  const role = Array.isArray(rawRole) ? rawRole[0] : rawRole;
  const [loading, setLoading] = React.useState(false);

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
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
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
        <View className="items-center mb-5">
          <Image
            source={require("@/assets/images/MOTOGUARD.png")}
            resizeMode="contain"
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
              <FormInput
                placeholder="Username"
                value={values.username}
                onChangeText={handleChange("username")}
                onBlur={handleBlur("username")}
                error={
                  touched.username && errors.username ? errors.username : ""
                }
              />
              <FormInput
                placeholder="Password"
                secureTextEntry
                value={values.password}
                onChangeText={handleChange("password")}
                onBlur={handleBlur("password")}
                error={
                  touched.password && errors.password ? errors.password : ""
                }
              />

              <View className="flex-row justify-between mt-8">
                <View className="flex-1 mr-2">
                  <CustomButton
                    title="Sign up"
                    onPress={handleSignUpPress}
                    containerStyle={{ paddingVertical: 12 }}
                  />
                </View>
                <View className="flex-1 ml-2">
                  <CustomButton
                    title="Sign in"
                    onPress={handleSubmit as () => void}
                    disabled={!isValid}
                    containerStyle={{
                      paddingVertical: 12,
                      backgroundColor: isValid ? "#65A30D" : "#A5ADAF",
                    }}
                  />
                </View>
              </View>
            </View>
          )}
        </Formik>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

export default Login;
