import { useEffect, useState } from "react";
import { View, Text } from "react-native";

export default function ArduinoStatus() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const API_URL = "http://192.168.148.40:5000";

    const fetchData = async () => {
      try {
        const res = await fetch(API_URL);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Fetch error:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={{ padding: 20 }}>
      {data ? (
        <>
          <Text>📍 Lat: {data.lat}</Text>
          <Text>📍 Lng: {data.lng}</Text>
          <Text>📏 Distance: {data.distance.toFixed(2)} m</Text>
          <Text>{data.moved ? "⚠️ MOVED" : "✅ SAFE"}</Text>
        </>
      ) : (
        <Text>Loading Arduino data...</Text>
      )}
    </View>
  );
}
