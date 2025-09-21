import * as yup from "yup";

export const loginValidationSchema = yup.object().shape({
  username: yup.string().required("Username is required"),
  password: yup.string().required("Password is required"),
});

export const userSignupValidationSchema = yup.object().shape({
  username: yup
    .string()
    .required("Username is required")
    .min(3, "Username must be at least 3 characters"),
  password: yup
    .string()
    .required("Password is required")
    .min(6, "Password must be at least 6 characters"),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("password")], "Passwords must match")
    .required("Please confirm your password"),
  fullName: yup.string().required("Full Name is required"),
  email: yup
    .string()
    .email("Invalid email address")
    .required("Email is required"),
  address: yup.string().required("Address is required"),
  gender: yup.string().required("Gender is required"),
  mobileNumber: yup
    .string()
    .required("Mobile Number is required")
    .matches(/^\d+$/, "Mobile Number must be digits only")
    .min(10, "Mobile Number must be at least 10 digits"),
});

export const vehicleValidationSchema = yup.object().shape({
  plateNumber: yup
    .string()
    .required("Plate Number is required")
    .matches(/^[A-Z0-9-]+$/, "Invalid Plate Number"),
  model: yup.string().required("Model is required"),
  brand: yup.string().required("Brand is required"),
  color: yup.string().required("Color is required"),
  systemNumber: yup
    .string()
    .required("System Number is required")
    .matches(/^\d+$/, "System Number must be numeric"),
});

export const stationSignupValidationSchema = yup.object().shape({
  username: yup.string().required("Username is required"),
  password: yup
    .string()
    .min(6, "Password must be at least 6 characters")
    .required("Password is required"),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("password")], "Passwords must match")
    .required("Confirm Password is required"),

  stationName: yup.string().required("Station Name is required"),
  stationNumber: yup.string().required("Station Number is required"),
  address: yup.string().required("Address is required"),
  email: yup.string().email("Invalid email").required("Email is required"),
  contactNumber: yup.string().required("Contact Number is required"),
});
