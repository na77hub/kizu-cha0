// server/validators.js

const ROOM_ID_FORBIDDEN_CHARS = /[\\/:*?"<>|.]/;
const CLIENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidRoomId(roomId) {
  return typeof roomId === "string" && roomId !== "" && !ROOM_ID_FORBIDDEN_CHARS.test(roomId);
}

export function isValidClientId(clientId) {
  return typeof clientId === "string" && CLIENT_ID_PATTERN.test(clientId);
}

export function isValidEndpoint(endpoint) {
  return typeof endpoint === "string" && endpoint !== "";
}

export function isValidSubscription(subscription) {
  return (
    !!subscription &&
    isValidEndpoint(subscription.endpoint) &&
    typeof subscription.keys?.p256dh === "string" &&
    typeof subscription.keys?.auth === "string"
  );
}

export function isValidText(text, maxLength) {
  return typeof text === "string" && text.length > 0 && text.length <= maxLength;
}
