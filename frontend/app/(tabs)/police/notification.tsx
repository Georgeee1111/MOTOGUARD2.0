import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore";
import { firebaseAuth, db } from "@/firebase/firebaseClient";
import CardContainer from "@/components/general/CardContainer";
import { router } from "expo-router";

type Report = {
  id: string;
  reportId: string;
  submittedBy: string;
  submittedAt: string;
  phone: string;
  plate: string;
  brand: string;
  description: string;
  status?: string;
};

export default function NotificationScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      const user = firebaseAuth.currentUser;
      if (!user || !user.email) {
        setError("User not authenticated. Please log in.");
        setLoading(false);
        return;
      }

      // ✅ only fetch reports assigned to this police email AND still unread
      const reportsQuery = query(
        collection(db, "reports"),
        where("toEmail", "==", user.email),
        where("status", "==", "unread")
      );

      const snapshot = await getDocs(reportsQuery);
      const list: Report[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const submittedAt =
          data.timestamp?.toDate?.() instanceof Date
            ? data.timestamp.toDate().toLocaleString()
            : "Unknown Date";

        list.push({
          id: docSnap.id,
          reportId: data.reportId || docSnap.id,
          submittedBy: data.owner || "Unknown",
          submittedAt,
          phone: data.phone || "N/A",
          plate: data.plate || "N/A",
          brand: data.brand || "N/A",
          description: data.description || "No description provided.",
          status: data.status || "unread",
        });
      });

      setReports(list);
    } catch (err) {
      console.error(err);
      setError("Failed to load report notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // ======================
  // Accept Report Handler
  // ======================
  const handleAccept = async (id: string) => {
    try {
      await updateDoc(doc(db, "reports", id), {
        status: "pending", // ✅ mark accepted → pending
      });
      Alert.alert("Success", "Report accepted.");
      fetchReports(); // refresh list
    } catch (err) {
      console.error("Error accepting report:", err);
      Alert.alert("Error", "Failed to accept report.");
    }
  };

  // ======================
  // Reject Report Handler
  // ======================
  const handleReject = async (id: string) => {
    try {
      await updateDoc(doc(db, "reports", id), {
        status: "rejected", // ✅ mark rejected
      });
      Alert.alert("Success", "Report rejected.");
      fetchReports(); // refresh list
    } catch (err) {
      console.error("Error rejecting report:", err);
      Alert.alert("Error", "Failed to reject report.");
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-white p-4">
        <Text className="text-red-600 text-center">{error}</Text>
      </View>
    );
  }

  if (reports.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-white p-4">
        <Text className="text-gray-600">No unread report notifications.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      {reports.map((report) => (
        <CardContainer key={report.id} className="mb-4">
          <Text className="text-sm text-black mb-1">
            Report ID: #{report.reportId}
          </Text>
          <Text className="text-sm text-black mb-1">
            Submitted By: {report.submittedBy}
          </Text>
          <Text className="text-sm text-black mb-4">
            Date/Time Submitted: {report.submittedAt}
          </Text>

          <Text className="text-sm font-semibold text-black mb-2">
            Incident Summary:
          </Text>

          <Text className="text-sm text-black mb-1">
            Phone Number: {report.phone}
          </Text>

          <View className="flex-row items-center mb-1">
            <Text className="text-sm text-black">Location: </Text>
            <Pressable
              onPress={() =>
                router.push("/policeviewlocations/policeviewlocation")
              }
            >
              <Text className="text-blue-600 underline">View location</Text>
            </Pressable>
          </View>

          <Text className="text-sm text-black mb-1">
            Plate Number: {report.plate}
          </Text>
          <Text className="text-sm text-black mb-1">Brand: {report.brand}</Text>
          <Text className="text-sm text-black mb-4">
            Description:{"\n"}
            {report.description}
          </Text>

          {/* no need to show current status, police only sees "unread" */}
          <View className="flex-row justify-between px-5 mt-4">
            <Pressable onPress={() => handleAccept(report.id)}>
              <Text className="text-green-600 text-sm">✅ Accept</Text>
            </Pressable>
            <Pressable onPress={() => handleReject(report.id)}>
              <Text className="text-red-600 text-sm">❌ Reject</Text>
            </Pressable>
          </View>
        </CardContainer>
      ))}
    </ScrollView>
  );
}
