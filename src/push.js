// src/push.js
import { emitWithAck } from "./socket.js";

const SERVICE_WORKER_URL = "./service-worker.js";

function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

function base64UrlToUint8Array(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

// Service Worker を登録し、Web Push の購読をサーバへ伝える。
export async function enablePush(socket) {
  if (!isPushSupported()) {
    console.warn("このブラウザは Web Push に対応していません。");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
    await navigator.serviceWorker.ready;

    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
      }));

    await emitWithAck(socket, "push:subscribe", { subscription: subscription.toJSON() });
  } catch (error) {
    console.error("Web Push の購読に失敗しました:", error);
  }
}

// 購読を解除し、サーバへ伝える。Service Worker の登録自体は残す。
export async function disablePush(socket) {
  if (!isPushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    const { endpoint } = subscription;
    if (await subscription.unsubscribe()) {
      await emitWithAck(socket, "push:unsubscribe", { endpoint });
    }
  } catch (error) {
    console.error("Web Push の購読解除に失敗しました:", error);
  }
}

export async function isPushEnabled() {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
    return (await registration?.pushManager.getSubscription()) != null;
  } catch (error) {
    console.error("購読状態の確認に失敗しました:", error);
    return false;
  }
}
