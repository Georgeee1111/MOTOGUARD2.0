import axios from "axios";
import { signInWithEmailAndPassword, getIdToken } from "firebase/auth";
import { firebaseAuth } from "@/firebase/firebaseClient";

const API_BASE_URL = "http://192.168.148.40:5000";

const getAuthHeader = async () => {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) throw new Error("No authenticated user");

  const token = await getIdToken(currentUser);
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

export const sendReport = async (reportData: any) => {
  const config = await getAuthHeader();
  const response = await axios.post(
    `${API_BASE_URL}/api/reports/send`,
    reportData,
    config
  );
  return response.data;
};

export const getReceivedReports = async (role: string) => {
  const config = await getAuthHeader();
  const response = await axios.get(
    `${API_BASE_URL}/api/reports/received?role=${role}`,
    config
  );
  return response.data;
};

export const getSentReports = async () => {
  const config = await getAuthHeader();
  const response = await axios.get(`${API_BASE_URL}/api/reports/sent`, config);
  return response.data;
};

export const registerUser = async (userData: any) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/users/register`,
    userData
  );
  return response.data;
};

export const registerStation = async (stationData: any) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/users/register-station`,
    stationData
  );
  return response.data;
};

export const getEmailByUsername = async (username: string) => {
  const response = await axios.post(`${API_BASE_URL}/api/users/get-email`, {
    username,
  });
  return response.data.email;
};

export const loginUser = async (username: string, password: string) => {
  const email = await getEmailByUsername(username);

  if (!email) {
    throw new Error("Email not found for username");
  }

  const userCredential = await signInWithEmailAndPassword(
    firebaseAuth,
    email,
    password
  );

  const token = await getIdToken(userCredential.user);

  return {
    uid: userCredential.user.uid,
    email: userCredential.user.email,
    token,
  };
};

export const getUserProfile = async (uid: string) => {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) throw new Error("No authenticated user");

  const token = await getIdToken(currentUser);

  const response = await axios.get(`${API_BASE_URL}/api/users/profile/${uid}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};

export const getProtectedData = async (endpoint: string) => {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) throw new Error("No authenticated user");

  const token = await getIdToken(currentUser);

  const response = await axios.get(`${API_BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};
