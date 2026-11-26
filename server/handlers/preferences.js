// server/handlers/preferences.js
import { parsePreference } from "../preferences.js";

export function registerPreferenceHandlers({ socket, handle, preferenceStore }) {
  const { roomId, clientId } = socket.data;

  handle("preferences:update", async (payload) => {
    const { value, error } = parsePreference(payload);
    if (error) return { ok: false, error };
    await preferenceStore.save({ roomId, clientId, ...value });
    return { ok: true, ...value };
  });

  return {
    async sendCurrent() {
      socket.emit("preferences:current", await preferenceStore.get(roomId, clientId));
    },
  };
}
