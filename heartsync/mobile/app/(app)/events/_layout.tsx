import { Stack } from "expo-router";

export default function EventsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="create" options={{ presentation: "modal" }} />
      <Stack.Screen name="invite" options={{ presentation: "modal" }} />
    </Stack>
  );
}
