import React, { useEffect, useState } from "react";
import { View, Platform, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Formik } from "formik";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import SectionHeader from "@/components/general/SectionHeader";
import FormInput from "@/components/general/FormInput";
import CustomButton from "@/components/general/CustomButton";
import { stationSignupValidationSchema } from "@/validationschema/validationSchemas";
import { StationFormValues } from "@/interfaces/station/StationFormValues";
import { firebaseAuth } from "@/firebase/firebaseClient";
import { getUserProfile, updateUserInfo } from "@/lib/api";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";

const StationEditInfo: React.FC = () => {
  const [initialValues, setInitialValues] = useState<StationFormValues | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchStationInfo = async () => {
      try {
        const user = firebaseAuth.currentUser;
        if (!user) return;

        // ✅ Fetch the current station info
        const response = await getUserProfile(user.uid);

        setInitialValues({
          username: response.username || "",
          password: "",
          confirmPassword: "",
          stationName: response.stationName || "",
          stationNumber: response.stationNumber || "",
          address: response.address || "",
          email: response.email || "",
          contactNumber: response.contactNumber || "",
        });
      } catch (error) {
        console.error(error);
        Alert.alert("Error", "Failed to load station info");
      } finally {
        setLoading(false);
      }
    };

    fetchStationInfo();
  }, []);

  const handleSubmit = async (values: StationFormValues) => {
    setSaving(true);
    try {
      const user = firebaseAuth.currentUser;
      if (!user) return;

      const payload = {
        username: values.username,
        stationName: values.stationName,
        stationNumber: values.stationNumber,
        address: values.address,
        email: values.email,
        contactNumber: values.contactNumber,
      };

      // ✅ Update Firestore data via backend
      await updateUserInfo(user.uid, payload, "police");

      // ✅ Handle password update if provided
      if (values.password && values.password.trim() !== "") {
        try {
          await updatePassword(user, values.password);
          Alert.alert("Success", "Password updated successfully!");
        } catch (error: any) {
          if (error.code === "auth/requires-recent-login") {
            Alert.prompt(
              "Reauthenticate",
              "Please enter your current password to update your account.",
              async (currentPassword) => {
                if (!currentPassword) return;

                try {
                  const credential = EmailAuthProvider.credential(
                    user.email!,
                    currentPassword
                  );
                  await reauthenticateWithCredential(user, credential);
                  await updatePassword(user, values.password);
                  Alert.alert("Success", "Password updated successfully!");
                } catch (reauthError: any) {
                  Alert.alert("Error", reauthError.message);
                }
              },
              "secure-text"
            );
          } else {
            Alert.alert("Error", error.message);
          }
        }
      }

      Alert.alert("Success", "Station information updated successfully!");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to update station info");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !initialValues) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#65A30D" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <KeyboardAwareScrollView
        enableOnAndroid
        enableAutomaticScroll
        extraScrollHeight={Platform.OS === "ios" ? 80 : 100}
        keyboardOpeningTime={Number.MAX_SAFE_INTEGER}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <Formik
          initialValues={initialValues}
          validationSchema={stationSignupValidationSchema}
          onSubmit={handleSubmit}
          enableReinitialize
          validateOnMount
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
            <View>
              {/* ✅ Account Section */}
              <SectionHeader title="Station Account" />
              <View className="px-6 mt-5 mb-7">
                <FormInput
                  placeholder="Username"
                  value={values.username}
                  onChangeText={handleChange("username")}
                  onBlur={handleBlur("username")}
                  error={
                    touched.username && errors.username ? errors.username : ""
                  }
                  autoCapitalize="none"
                />

                <FormInput
                  placeholder="Password"
                  value={values.password}
                  onChangeText={handleChange("password")}
                  onBlur={handleBlur("password")}
                  error={
                    touched.password && errors.password ? errors.password : ""
                  }
                  secureTextEntry
                  autoCapitalize="none"
                />

                <FormInput
                  placeholder="Confirm Password"
                  value={values.confirmPassword}
                  onChangeText={handleChange("confirmPassword")}
                  onBlur={handleBlur("confirmPassword")}
                  error={
                    touched.confirmPassword && errors.confirmPassword
                      ? errors.confirmPassword
                      : ""
                  }
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              {/* ✅ Station Information Section */}
              <SectionHeader title="Station Information" />
              <View className="px-6 mt-5 mb-5">
                <FormInput
                  placeholder="Station Name"
                  value={values.stationName}
                  onChangeText={handleChange("stationName")}
                  onBlur={handleBlur("stationName")}
                  error={
                    touched.stationName && errors.stationName
                      ? errors.stationName
                      : ""
                  }
                />

                <FormInput
                  placeholder="Station Number"
                  value={values.stationNumber}
                  onChangeText={handleChange("stationNumber")}
                  onBlur={handleBlur("stationNumber")}
                  error={
                    touched.stationNumber && errors.stationNumber
                      ? errors.stationNumber
                      : ""
                  }
                />

                <FormInput
                  placeholder="Address"
                  value={values.address}
                  onChangeText={handleChange("address")}
                  onBlur={handleBlur("address")}
                  error={
                    touched.address && errors.address ? errors.address : ""
                  }
                />

                <FormInput
                  placeholder="Email Address"
                  value={values.email}
                  onChangeText={handleChange("email")}
                  onBlur={handleBlur("email")}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={touched.email && errors.email ? errors.email : ""}
                />

                <FormInput
                  placeholder="Contact Number"
                  value={values.contactNumber}
                  onChangeText={handleChange("contactNumber")}
                  onBlur={handleBlur("contactNumber")}
                  keyboardType="phone-pad"
                  error={
                    touched.contactNumber && errors.contactNumber
                      ? errors.contactNumber
                      : ""
                  }
                />
              </View>

              <View className="mt-8 mb-2">
                <CustomButton
                  title={
                    saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      "Save Changes"
                    )
                  }
                  onPress={() => handleSubmit()}
                  disabled={!isValid || saving}
                  containerStyle={{
                    backgroundColor: "#65A30D",
                    opacity: !isValid || saving ? 0.6 : 1,
                    paddingVertical: 16,
                    borderRadius: 8,
                    width: "90%",
                    alignSelf: "center",
                  }}
                  textStyle={{
                    color: "#fff",
                    textAlign: "center",
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                />
              </View>
            </View>
          )}
        </Formik>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

export default StationEditInfo;
