import React, { useEffect, useState } from "react";
import { Text, View, ScrollView, ActivityIndicator } from "react-native";
import CardContainer from "@/components/general/CardContainer";
import { getSentReports } from "@/lib/api";
import moment from "moment";

interface ReportLog {
  id: string;
  timestamp: string;
  status: string;
}

const ReportLogs: React.FC = () => {
  const [reports, setReports] = useState<ReportLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const fetched = await getSentReports();
        setReports(fetched);
      } catch (err) {
        console.error("Error fetching sent reports:", err);
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
        <Text className="mt-2 text-gray-500">Loading your report logs...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white px-4 pt-4 pb-6">
      {reports.length === 0 ? (
        <Text className="text-center text-gray-500 mt-6">
          No reports submitted yet.
        </Text>
      ) : (
        reports.map((report) => (
          <CardContainer key={report.id} className="mb-4">
            <Text className="text-gray-600 text-sm">
              Report ID: # {report.id}
            </Text>
            <Text className="text-gray-600 text-sm mt-1">
              Date Submitted: {moment(report.timestamp).format("MMMM D, YYYY")}
            </Text>
            <View className="flex-row items-center mt-1">
              <Text className="text-gray-600 text-sm mr-1">Status:</Text>
              <Text
                className={`text-sm mr-1 ${
                  report.status === "unread"
                    ? "text-yellow-500"
                    : report.status === "read"
                    ? "text-green-500"
                    : "text-gray-500"
                }`}
              >
                {report.status === "unread"
                  ? "🟡"
                  : report.status === "read"
                  ? "🟢"
                  : "⚪"}
              </Text>
              <Text className="text-gray-500 italic text-sm">
                {report.status}
              </Text>
            </View>
          </CardContainer>
        ))
      )}
    </ScrollView>
  );
};

export default ReportLogs;
