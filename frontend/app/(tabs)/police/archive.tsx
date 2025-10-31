import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import CardContainer from "@/components/general/CardContainer";
import { getProtectedData } from "@/lib/api";

type Report = {
  id: string;
  submittedBy: string;
  submittedAt: string;
  status: string;
};

export default function ArchiveScreen() {
  const [archivedReports, setArchivedReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArchivedReports = async () => {
      try {
        const data = await getProtectedData("/api/reports/archived");
        const reports: Report[] = data.reports.map((r: any) => ({
          id: r.id,
          submittedBy: r.owner || "Unknown",
          submittedAt: r.archivedAt
            ? new Date(r.archivedAt._seconds * 1000).toLocaleString()
            : r.timestamp
            ? new Date(r.timestamp._seconds * 1000).toLocaleString()
            : "Unknown Date",
          status: r.status || "resolved",
        }));
        setArchivedReports(reports);
      } catch (err) {
        console.error(err);
        setError("Failed to load archived reports.");
      } finally {
        setLoading(false);
      }
    };

    fetchArchivedReports();
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

  if (archivedReports.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-white p-4">
        <Text className="text-gray-600">No archived reports available.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="bg-white p-4">
      {archivedReports.map((report) => (
        <CardContainer key={report.id} className="mb-4" noPadding>
          <Text className="text-sm text-black mb-1">
            Report ID: #{report.id}
          </Text>
          <Text className="text-sm text-black mb-1">
            Submitted By: {report.submittedBy}
          </Text>
          <Text className="text-sm text-black mb-1">
            Date/Time Archived: {report.submittedAt}
          </Text>

          <View className="flex-row items-center mt-2 mb-4">
            <Text className="text-sm italic text-gray-600 mr-2">Status:</Text>
            <View className="flex-row items-center">
              <View
                className={`w-3 h-3 rounded-full mr-2 ${
                  report.status === "pending"
                    ? "bg-yellow-500"
                    : report.status === "on progress"
                    ? "bg-orange-500"
                    : "bg-green-500"
                }`}
              />
              <Text className="italic font-semibold text-black">
                {report.status === "pending"
                  ? "Pending"
                  : report.status === "on progress"
                  ? "On Progress"
                  : "Resolved"}
              </Text>
            </View>
          </View>
        </CardContainer>
      ))}
    </ScrollView>
  );
}
