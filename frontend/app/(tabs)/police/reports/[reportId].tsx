import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import CardContainer from "@/components/general/CardContainer";
import { getReportById } from "@/lib/api"; // Your firebase fetching function

interface Report {
  id: string;
  owner: string;
  timestamp: string | number;
  status: string;
  description?: string;
  additionalInfo?: string;
}

export default function ReportDetail() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const router = useRouter();

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchReport() {
      if (!reportId) {
        setError("No report ID provided.");
        setLoading(false);
        return;
      }

      try {
        const data = await getReportById(reportId);
        setReport(data);
      } catch (err) {
        setError("Failed to load report.");
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [reportId]);

  if (loading)
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );

  if (error)
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text className="text-red-600">{error}</Text>
      </View>
    );

  if (!report)
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text>No report found</Text>
      </View>
    );

  return (
    <ScrollView className="flex-1 bg-white p-4">
      <CardContainer>
        <Text className="text-sm text-black mb-1">Report ID: #{report.id}</Text>
        <Text className="text-sm text-black mb-1">
          Submitted By: {report.owner}
        </Text>
        <Text className="text-sm text-black mb-1">
          Date/Time Submitted: {new Date(report.timestamp).toLocaleString()}
        </Text>
        <View className="flex-row justify-between items-center mt-2">
          <Text className="text-sm italic text-gray-600">
            Status: <Text className="italic">{report.status}</Text>
          </Text>
          <Pressable onPress={() => alert("Archive feature coming soon")}>
            <Text className="text-sm font-semibold text-black">
              Move to archive
            </Text>
          </Pressable>
        </View>
        {report.description ? (
          <Text className="mt-4 text-black">{report.description}</Text>
        ) : null}
        {report.additionalInfo ? (
          <Text className="mt-2 italic text-gray-600">
            {report.additionalInfo}
          </Text>
        ) : null}
      </CardContainer>
    </ScrollView>
  );
}
