import React from "react";
import { View, TextInput, Text, TextInputProps } from "react-native";

interface FormInputProps extends TextInputProps {
  error?: string;
}

const FormInput: React.FC<FormInputProps> = ({ error, style, ...props }) => {
  return (
    <View>
      <TextInput
        {...props}
        style={[
          {
            borderBottomWidth: 1,
            borderBottomColor: error ? "red" : "#D1D5DB",
            paddingVertical: 15,
            fontSize: 20,
            color: "#000",
          },
          style,
        ]}
        placeholderTextColor="#999"
      />
      {error ? (
        <Text style={{ color: "red", marginTop: 4, fontSize: 12 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

export default FormInput;
