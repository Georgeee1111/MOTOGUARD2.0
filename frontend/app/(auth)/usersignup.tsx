import React, { useState, useMemo } from "react";
import { View, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Formik, FormikHelpers } from "formik";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import SectionHeader from "@/components/general/SectionHeader";
import FormInput from "@/components/general/FormInput";
import CustomButton from "@/components/general/CustomButton";

import { registerUser } from "@/lib/api";

import {
  userSignupValidationSchema,
  vehicleValidationSchema,
} from "@/validationschema/validationSchemas";

import { UserSignupData } from "@/interfaces/ownersignup/UserSignUpData";
import { VehicleInfo } from "@/interfaces/ownersignup/VehicleInfo";

type FormValues = UserSignupData & VehicleInfo;

const UserSignup: React.FC = () => {
  const router = useRouter();

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  const initialValues: FormValues = useMemo(
    () => ({
      username: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      email: "",
      address: "",
      gender: "",
      mobileNumber: "",

      plateNumber: "",
      model: "",
      brand: "",
      color: "",
      systemNumber: "",
    }),
    []
  );

  const getValidationSchema = () =>
    step === 1 ? userSignupValidationSchema : vehicleValidationSchema;

  const handleFormSubmit = async (
    values: FormValues,
    actions: FormikHelpers<FormValues>
  ) => {
    if (step === 1) {
      setStep(2);
      actions.setTouched({});
    } else {
      setLoading(true);
      try {
        const payload = {
          username: values.username,
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          vehicleInfo: {
            plateNumber: values.plateNumber,
            model: values.model,
            brand: values.brand,
            color: values.color,
            systemNumber: values.systemNumber,
          },
        };

        console.log("Register payload:", payload);

        const response = await registerUser(payload);
        console.log("✅ Registered:", response);

        router.push("/(auth)/login");
      } catch (error: any) {
        console.error(
          "❌ Registration failed:",
          error?.response?.data || error.message
        );
      } finally {
        setLoading(false);
      }
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
          validationSchema={getValidationSchema()}
          onSubmit={handleFormSubmit}
          validateOnMount={true}
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
              {step === 1 && (
                <>
                  <SectionHeader title="User Account" />
                  <View className="px-6 mt-5 mb-5">
                    <FormInput
                      placeholder="Username"
                      value={values.username}
                      onChangeText={handleChange("username")}
                      onBlur={handleBlur("username")}
                      error={
                        touched.username && errors.username
                          ? errors.username
                          : ""
                      }
                      autoCapitalize="none"
                    />
                    <FormInput
                      placeholder="Password"
                      value={values.password}
                      onChangeText={handleChange("password")}
                      onBlur={handleBlur("password")}
                      error={
                        touched.password && errors.password
                          ? errors.password
                          : ""
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

                  <SectionHeader title="User Information" />
                  <View className="px-6 mt-5">
                    <FormInput
                      placeholder="Full Name"
                      value={values.fullName}
                      onChangeText={handleChange("fullName")}
                      onBlur={handleBlur("fullName")}
                      error={
                        touched.fullName && errors.fullName
                          ? errors.fullName
                          : ""
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
                      placeholder="Address"
                      value={values.address}
                      onChangeText={handleChange("address")}
                      onBlur={handleBlur("address")}
                      error={
                        touched.address && errors.address ? errors.address : ""
                      }
                    />
                    <FormInput
                      placeholder="Gender"
                      value={values.gender}
                      onChangeText={handleChange("gender")}
                      onBlur={handleBlur("gender")}
                      error={
                        touched.gender && errors.gender ? errors.gender : ""
                      }
                    />
                    <FormInput
                      placeholder="Mobile Number"
                      value={values.mobileNumber}
                      onChangeText={handleChange("mobileNumber")}
                      onBlur={handleBlur("mobileNumber")}
                      error={
                        touched.mobileNumber && errors.mobileNumber
                          ? errors.mobileNumber
                          : ""
                      }
                      keyboardType="phone-pad"
                    />
                  </View>
                </>
              )}

              {step === 2 && (
                <>
                  <SectionHeader title="Vehicle Information" />
                  <View className="px-6 mt-5 mb-5">
                    <FormInput
                      placeholder="Plate Number"
                      value={values.plateNumber}
                      onChangeText={handleChange("plateNumber")}
                      onBlur={handleBlur("plateNumber")}
                      error={
                        touched.plateNumber && errors.plateNumber
                          ? errors.plateNumber
                          : ""
                      }
                    />
                    <FormInput
                      placeholder="Model"
                      value={values.model}
                      onChangeText={handleChange("model")}
                      onBlur={handleBlur("model")}
                      error={touched.model && errors.model ? errors.model : ""}
                    />
                    <FormInput
                      placeholder="Brand"
                      value={values.brand}
                      onChangeText={handleChange("brand")}
                      onBlur={handleBlur("brand")}
                      error={touched.brand && errors.brand ? errors.brand : ""}
                    />
                    <FormInput
                      placeholder="Color"
                      value={values.color}
                      onChangeText={handleChange("color")}
                      onBlur={handleBlur("color")}
                      error={touched.color && errors.color ? errors.color : ""}
                    />
                    <FormInput
                      placeholder="System Number"
                      value={values.systemNumber}
                      onChangeText={handleChange("systemNumber")}
                      onBlur={handleBlur("systemNumber")}
                      error={
                        touched.systemNumber && errors.systemNumber
                          ? errors.systemNumber
                          : ""
                      }
                      keyboardType="numeric"
                    />
                  </View>
                </>
              )}

              <View className="mt-8 mb-2">
                <CustomButton
                  title={
                    loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : step === 1 ? (
                      "Next"
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

export default UserSignup;
