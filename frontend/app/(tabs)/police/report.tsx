import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
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
import { archiveReportApi } from "@/lib/api";

type Report = {
  id: string;
  submittedBy: string;
  submittedAt: string;
  status: string;
};

export default function SummaryOfReportScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const user = firebaseAuth.currentUser;
        if (!user || !user.email) {
          setError("User not authenticated. Please log in.");
          setLoading(false);
          return;
        }

        const reportsQuery = query(
          collection(db, "reports"),
          where("toEmail", "==", user.email),
          where("archived", "==", false)
        );

        const reportsSnapshot = await getDocs(reportsQuery);
        const reportsList: Report[] = [];

        reportsSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const submittedAt =
            data.timestamp?.toDate?.() instanceof Date
              ? data.timestamp.toDate().toLocaleString()
              : "Unknown Date";

          reportsList.push({
            id: docSnap.id,
            submittedBy: data.owner || "Unknown",
            submittedAt,
            status: data.status || "unread", // ✅ default to unread
          });
        });

        setReports(reportsList);
      } catch (err) {
        setError("Failed to load reports");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  // 🔹 Update report status
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "reports", id), { status: newStatus });
      setReports((prev) =>
        prev.map((report) =>
          report.id === id ? { ...report, status: newStatus } : report
        )
      );
      setModalVisible(false);
      setSelectedReport(null);
    } catch (err) {
      console.error("Error updating status:", err);
      Alert.alert("Error", "Failed to update report status.");
    }
  };

  const handleArchiveReport = async (id: string) => {
    try {
      await archiveReportApi(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      Alert.alert("Success", "Report moved to archive.");
    } catch (err) {
      console.error("Error archiving report:", err);
      Alert.alert("Error", "Failed to archive report.");
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
        <Text className="text-gray-600">No reports available.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView>
        {reports.map((report) => (
          <CardContainer key={report.id} className="mb-4">
            <Text className="text-sm text-black mb-1">
              Report ID: #{report.id}
            </Text>
            <Text className="text-sm text-black mb-1">
              Submitted By: {report.submittedBy}
            </Text>
            <Text className="text-sm text-black mb-1">
              Date/Time Submitted: {report.submittedAt}
            </Text>

            <View className="flex-row justify-between items-center mt-2">
              <Pressable
                onPress={() => {
                  setSelectedReport(report);
                  setModalVisible(true);
                }}
                className="flex-row items-center"
              >
                <Text className="text-sm italic text-gray-600 mr-2">
                  Status:
                </Text>
                <View className="flex-row items-center">
                  {/* ✅ Added color for "pending" */}
                  <View
                    className={`w-3 h-3 rounded-full mr-2 ${
                      report.status === "unread"
                        ? "bg-gray-400"
                        : report.status === "pending"
                        ? "bg-blue-500"
                        : report.status === "on progress"
                        ? "bg-yellow-500"
                        : report.status === "resolved"
                        ? "bg-green-500"
                        : "bg-gray-300"
                    }`}
                  />
                  <Text className="italic font-semibold text-black">
                    {report.status === "unread"
                      ? "Unread"
                      : report.status === "pending"
                      ? "Pending"
                      : report.status === "on progress"
                      ? "On Progress"
                      : report.status === "resolved"
                      ? "Resolved"
                      : "Unknown"}
                  </Text>
                </View>
              </Pressable>

              {report.status === "resolved" && (
                <Pressable onPress={() => handleArchiveReport(report.id)}>
                  <Text className="text-sm font-semibold text-black">
                    Move to archive
                  </Text>
                </Pressable>
              )}
            </View>
          </CardContainer>
        ))}
      </ScrollView>

      {/* 🔹 Status Update Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white w-4/5 rounded-xl p-6">
            <Text className="text-lg font-semibold mb-4 text-center">
              Update Status
            </Text>

            {/* ✅ Added Pending option */}
            <TouchableOpacity
              className="p-3 bg-gray-200 rounded-lg mb-3"
              onPress={() =>
                selectedReport &&
                handleUpdateStatus(selectedReport.id, "pending")
              }
            >
              <Text className="text-center text-black">Pending</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="p-3 bg-gray-200 rounded-lg mb-3"
              onPress={() =>
                selectedReport &&
                handleUpdateStatus(selectedReport.id, "on progress")
              }
            >
              <Text className="text-center text-black">On Progress</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="p-3 bg-gray-200 rounded-lg mb-3"
              onPress={() =>
                selectedReport &&
                handleUpdateStatus(selectedReport.id, "resolved")
              }
            >
              <Text className="text-center text-black">Resolved</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="p-3 bg-red-500 rounded-lg"
              onPress={() => setModalVisible(false)}
            >
              <Text className="text-center text-white">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
