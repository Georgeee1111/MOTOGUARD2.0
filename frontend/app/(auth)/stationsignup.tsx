import React, { useState } from "react";
import { View, Platform, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Formik, FormikHelpers } from "formik";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import SectionHeader from "@/components/general/SectionHeader";
import FormInput from "@/components/general/FormInput";
import CustomButton from "@/components/general/CustomButton";
import { stationSignupValidationSchema } from "@/validationschema/validationSchemas";
import { StationFormValues } from "@/interfaces/station/StationFormValues";
import { registerStation } from "@/lib/api";

const stationsignup: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const initialValues: StationFormValues = {
    username: "",
    password: "",
    confirmPassword: "",
    stationName: "",
    stationNumber: "",
    address: "",
    email: "",
    contactNumber: "",
  };

  const handleFormSubmit = async (
    values: StationFormValues,
    actions: FormikHelpers<StationFormValues>
  ) => {
    setLoading(true);
    try {
      const { confirmPassword, ...stationData } = values;

      await registerStation(stationData);

      router.push("/(auth)/login");

      actions.resetForm();
    } catch (error: any) {
      Alert.alert(
        "Registration Failed",
        error?.response?.data?.error || error.message || "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  };

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
          onSubmit={handleFormSubmit}
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
                  error={touched.email && errors.email ? errors.email : ""}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <FormInput
                  placeholder="Contact Number"
                  value={values.contactNumber}
                  onChangeText={handleChange("contactNumber")}
                  onBlur={handleBlur("contactNumber")}
                  error={
                    touched.contactNumber && errors.contactNumber
                      ? errors.contactNumber
                      : ""
                  }
                  keyboardType="phone-pad"
                />
              </View>

              <View className="mt-8 mb-2">
                <CustomButton
                  title={
                    loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      "Create Account"
                    )
                  }
                  onPress={() => handleSubmit()}
                  disabled={!isValid || loading}
                  containerStyle={{
                    backgroundColor: "#65A30D",
                    opacity: !isValid || loading ? 0.6 : 1,
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

export default stationsignup;
