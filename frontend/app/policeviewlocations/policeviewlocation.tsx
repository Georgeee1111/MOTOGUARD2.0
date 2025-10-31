import React, { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, Text, Alert } from "react-native";
import MapView, { Marker, UrlTile, Region } from "react-native-maps";

interface ArduinoData {
  lat: number;
  lng: number;
  distance?: number;
  moved?: boolean;
}

const PoliceViewLocation = () => {
  const [arduinoData, setArduinoData] = useState<ArduinoData | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const fetchArduinoData = async () => {
      try {
        // 🛰 Fetch the Arduino's live GPS location
        const res = await fetch("http://192.168.1.8:5000/api/arduino");
        const data: ArduinoData = await res.json();

        if (data.lat != null && data.lng != null) {
          setArduinoData(data);

          // Smoothly move map camera to the new position
          const region: Region = {
            latitude: data.lat,
            longitude: data.lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
          mapRef.current?.animateToRegion(region, 1000);
        }
      } catch (err) {
        Alert.alert("Error", "Unable to fetch Arduino data");
      } finally {
        setLoading(false);
      }
    };

    fetchArduinoData();

    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchArduinoData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
        <Text>Fetching vehicle GPS...</Text>
      </View>
    );
  }

  if (!arduinoData) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-red-600">No GPS data available yet</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: arduinoData.lat,
          longitude: arduinoData.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <UrlTile
          urlTemplate="https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          maximumZ={19}
        />

        <Marker
          coordinate={{ latitude: arduinoData.lat, longitude: arduinoData.lng }}
          title="Vehicle Location"
          description={
            arduinoData.moved
              ? `Moved ${
                  typeof arduinoData.distance === "number"
                    ? arduinoData.distance.toFixed(2)
                    : "N/A"
                }m from base`
              : "Still in place"
          }
        />
      </MapView>
    </View>
  );
};

export default PoliceViewLocation;
