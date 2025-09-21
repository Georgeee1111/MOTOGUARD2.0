import React, { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, Text, Alert } from "react-native";
import MapView, { Marker, UrlTile } from "react-native-maps";
import * as Location from "expo-location";
import { Coordinates } from "@/interfaces/ownerscreen/Location";
import CustomButton from "@/components/general/CustomButton";

const LocationScreen = () => {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        let loc = null;

        if (status === "granted") {
          loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          });
        } else {
          loc = await Location.getLastKnownPositionAsync();
          if (!loc) {
            Alert.alert(
              "Location Permission Denied",
              "Cannot access location and no last known location found."
            );
            return;
          }
        }

        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setLocation(coords);

        const reverseGeocoded = await Location.reverseGeocodeAsync(coords);
        if (reverseGeocoded.length > 0) {
          const addr = reverseGeocoded[0];
          setAddress(
            `${addr.name ?? ""} ${addr.street ?? ""}, ${addr.city ?? ""}, ${
              addr.region ?? ""
            }, ${addr.country ?? ""}`
              .replace(/\s+/g, " ")
              .trim()
          );
        }
      } catch {
        Alert.alert("Error", "Unable to get location.");
      } finally {
        setInitialLoading(false);
      }
    })();
  }, []);

  const getLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Cannot access location.");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setLocation(coords);

      const reverseGeocoded = await Location.reverseGeocodeAsync(coords);
      if (reverseGeocoded.length > 0) {
        const addr = reverseGeocoded[0];
        setAddress(
          `${addr.name ?? ""} ${addr.street ?? ""}, ${addr.city ?? ""}, ${
            addr.region ?? ""
          }, ${addr.country ?? ""}`
            .replace(/\s+/g, " ")
            .trim()
        );
      } else {
        setAddress(null);
      }

      mapRef.current?.animateToRegion(
        {
          ...coords,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        1000
      );
    } catch {
      Alert.alert("Error", "Error getting location");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
        <Text>Loading map...</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View className="flex-1 justify-center items-center p-5">
        <Text className="text-center text-red-600">
          Location not available. Please enable location permissions and try
          again.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        region={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <UrlTile
          urlTemplate="https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          maximumZ={19}
        />
        <Marker coordinate={location} title="You are here" />
      </MapView>

      <View className="absolute bottom-10 left-5 right-5 bg-transparent bg-opacity-90 rounded-lg p-3 items-center">
        <CustomButton
          title={loading ? "Locating..." : "Locate My Vehicle"}
          onPress={getLocation}
          disabled={loading}
          containerStyle={{
            backgroundColor: "#65a30d",
            width: "80%",
            paddingVertical: 12,
            borderRadius: 8,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            opacity: loading ? 0.7 : 1,
          }}
          textStyle={{
            color: "#fff",
            fontWeight: "700",
            textAlign: "center",
          }}
          leftIcon={
            loading ? (
              <ActivityIndicator color="white" style={{ marginRight: 10 }} />
            ) : undefined
          }
        />
      </View>
    </View>
  );
};

export default LocationScreen;
