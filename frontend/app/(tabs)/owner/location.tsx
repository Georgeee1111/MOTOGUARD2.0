import React, { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, Text, Alert } from "react-native";
import MapView, { Marker, UrlTile, Region } from "react-native-maps";

interface ArduinoData {
  lat: number;
  lng: number;
  distance?: number;
  moved?: boolean;
}

const LocationScreen = () => {
  const [arduinoData, setArduinoData] = useState<ArduinoData | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const fetchArduinoData = async () => {
      try {
        const res = await fetch("http://192.168.170.40:5000/api/arduino");
        const data: ArduinoData = await res.json();
        if (data.lat != null && data.lng != null) {
          setArduinoData(data);

          // Animate map to new location
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

    // fetch once on mount
    fetchArduinoData();

    // fetch every 5s for live updates
    const interval = setInterval(fetchArduinoData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
        <Text>Fetching Arduino GPS...</Text>
      </View>
    );
  }

  if (!arduinoData) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-red-600">No Arduino data available yet</Text>
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
          title="Device Location"
          description={
            arduinoData.moved
              ? `Moved ${
                  typeof arduinoData.distance === "number"
                    ? arduinoData.distance.toFixed(2)
                    : "N/A"
                }m from home`
              : "Still at home"
          }
        />
      </MapView>
    </View>
  );
};

export default LocationScreen;
