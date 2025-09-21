import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { collection, getDocs, query, where } from "firebase/firestore";
import { firebaseAuth, db } from "@/firebase/firebaseClient";
import CardContainer from "@/components/general/CardContainer";

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

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const user = firebaseAuth.currentUser;
        if (!user || !user.email) {
          setError("User not authenticated. Please log in.");
          setLoading(false);
          return;
        }

        // Filter reports by toEmail equal to current user's email
        const reportsQuery = query(
          collection(db, "reports"),
          where("toEmail", "==", user.email)
        );

        const reportsSnapshot = await getDocs(reportsQuery);
        const reportsList: Report[] = [];

        reportsSnapshot.forEach((doc) => {
          const data = doc.data();
          const submittedAt =
            data.timestamp?.toDate?.() instanceof Date
              ? data.timestamp.toDate().toLocaleString()
              : "Unknown Date";

          reportsList.push({
            id: doc.id,
            submittedBy: data.owner || "Unknown",
            submittedAt,
            status: data.status || "Unknown",
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
    <ScrollView className="flex-1 bg-white">
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
            <Text className="text-sm italic text-gray-600">
              Status: <Text className="italic">{report.status}</Text>
            </Text>

            <Pressable>
              <Text className="text-sm font-semibold text-black">
                Move to archive
              </Text>
            </Pressable>
          </View>
        </CardContainer>
      ))}
    </ScrollView>
  );
}
