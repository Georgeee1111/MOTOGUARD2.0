import React from "react";
import {
  View,
  TextInput,
  Text,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from "react-native";

interface FormInputProps extends TextInputProps {
  error?: string;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  errorStyle?: TextStyle;
  wrapperStyle?: ViewStyle;
  placeholderColor?: string;
  textColor?: string;
}

const FormInput: React.FC<FormInputProps> = ({
  error,
  rightIcon,
  style,
  containerStyle,
  inputStyle,
  errorStyle,
  wrapperStyle,
  placeholderColor = "#999",
  textColor = "#000",
  ...props
}) => {
  return (
    <View style={[{ marginBottom: 16 }, containerStyle]}>
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: error ? "red" : "#D1D5DB",
          },
          wrapperStyle,
        ]}
      >
        <TextInput
          {...props}
          style={[
            {
              flex: 1,
              paddingVertical: 15,
              fontSize: 20,
              color: textColor,
            },
            inputStyle,
            style,
          ]}
          placeholderTextColor={placeholderColor}
        />
        {rightIcon ? <View style={{ marginLeft: 8 }}>{rightIcon}</View> : null}
      </View>

      {error ? (
        <Text
          style={[{ color: "red", marginTop: 4, fontSize: 12 }, errorStyle]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
};

export default FormInput;
