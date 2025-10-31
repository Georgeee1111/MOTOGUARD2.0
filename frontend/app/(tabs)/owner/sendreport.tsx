import React, { useState } from "react";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from "react-native";
import ToInput from "@/components/sendreport/ToInput";
import StepOneForm from "@/components/sendreport/StepOneForm";
import StepTwoUpload from "@/components/sendreport/StepTwoUpload";
import type { Field } from "@/components/sendreport/StepOneForm";
import { sendReport } from "@/lib/api";

const SendReport = () => {
  const [step, setStep] = useState(1);
  const [to, setTo] = useState("");
  const [owner, setOwner] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [agree, setAgree] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState("");

  const fields: Field[] = [
    { label: "Owner:", value: owner, setter: setOwner },
    {
      label: "Phone Number:",
      value: phone,
      setter: setPhone,
      keyboardType: "phone-pad",
    },
    { label: "Date of Incident:", value: date, setter: setDate },
    { label: "Time:", value: time, setter: setTime },
    { label: "Location:", value: location, setter: setLocation },
    { label: "Plate Number:", value: plate, setter: setPlate },
    { label: "Brand:", value: brand, setter: setBrand },
  ];

  const handleSubmit = async () => {
    if (!agree) {
      alert("Please check the attestation box.");
      return;
    }

    try {
      const reportPayload = {
        toEmail: to,
        owner,
        phone,
        date,
        time,
        location,
        plate,
        brand,
        description,
        additionalInfo,
        receiverRole: to.toLowerCase(),
      };

      await sendReport(reportPayload);

      Alert.alert("Success", "Report sent successfully.");
      setStep(1);
      setTo("");
      setOwner("");
      setPhone("");
      setDate("");
      setTime("");
      setLocation("");
      setPlate("");
      setBrand("");
      setDescription("");
      setAdditionalInfo("");
      setAgree(false);
    } catch (error) {
      console.error("Failed to send report:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "white" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1, backgroundColor: "white" }}>
          {/* ✅ White wrapper */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 24,
              paddingBottom: 40,
              backgroundColor: "white",
            }}
          >
            <View style={{ minHeight: 850 }}>
              <ToInput to={to} setTo={setTo} />
              {step === 1 ? (
                <StepOneForm
                  fields={fields}
                  description={description}
                  setDescription={setDescription}
                  onNext={() => setStep(2)}
                />
              ) : (
                <StepTwoUpload
                  agree={agree}
                  setAgree={setAgree}
                  onSubmit={handleSubmit}
                  onBack={() => setStep(1)}
                />
              )}
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default SendReport;
