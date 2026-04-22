import { Stack } from "expo-router";
import React from "react";

export default function ArriveLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#0B1C3D" },
      }}
    />
  );
}
