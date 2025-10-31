import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase/firebaseClient";
import SectionHeader from "@/components/general/SectionHeader";

interface PoliceStation {
  id: string;
  name: string;
  location: string;
  contact_number: string;
}

export default function PoliceStationsScreen() {
  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [filteredStations, setFilteredStations] = useState<PoliceStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "police_stations"));
        const data: PoliceStation[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<PoliceStation, "id">),
        }));
        setStations(data);
        setFilteredStations(data);
      } catch (error) {
        console.error("Error fetching police stations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStations();
  }, []);

  const handleSearch = (text: string) => {
    setSearch(text);
    const filtered = stations.filter(
      (station) =>
        station.name.toLowerCase().includes(text.toLowerCase()) ||
        station.location.toLowerCase().includes(text.toLowerCase()) ||
        station.contact_number.includes(text)
    );
    setFilteredStations(filtered);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" />
        <Text className="mt-3 text-gray-600">Loading police stations...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <View className="flex-1 bg-white">
        {/* ✅ Properly visible header now */}
        <SectionHeader title="CDO Police Station" />

        {/* Search Bar */}
        <View className="bg-white p-4 shadow-md rounded-2xl m-4">
          <TextInput
            placeholder="Search"
            value={search}
            onChangeText={handleSearch}
            className="bg-gray-100 p-3 rounded-xl shadow-sm"
          />
        </View>

        {/* Table Header */}
        <View className="flex-row border-b border-gray-300 px-2 py-2">
          <Text className="flex-1 font-semibold text-gray-800 text-center">
            Station Number
          </Text>
          <Text className="flex-1 font-semibold text-gray-800 text-center">
            Station Address
          </Text>
          <Text className="flex-1 font-semibold text-gray-800 text-center">
            Contact Number
          </Text>
        </View>

        {/* Table Rows */}
        <ScrollView>
          {filteredStations.length === 0 ? (
            <Text className="text-center text-gray-500 mt-5">
              No police stations found.
            </Text>
          ) : (
            filteredStations.map((station, index) => (
              <View
                key={station.id}
                className={`flex-row items-center px-2 py-3 ${
                  index % 2 === 0 ? "bg-gray-100" : "bg-white"
                } border-b border-gray-200`}
              >
                <Text className="flex-1 text-center text-gray-800">
                  {index + 1}
                </Text>
                <Text className="flex-1 text-center text-gray-800">
                  {station.location}
                </Text>
                <Text className="flex-1 text-center text-gray-800">
                  {station.contact_number}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
