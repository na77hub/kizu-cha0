// script.js
import $ from "jquery";
import io from "socket.io-client";

$(function() {

    // ブラウザのディベロッパーツールのコンソールに表示されます
    console.log(`VAPID_PUBLIC_KEY=${import.meta.env.VITE_VAPID_PUBLIC_KEY}`);

    //const elem = document.getElementByID("#room");
    //elem.textContet = "hoge";
    $("#room").text("hoge");


    getRoomIdFromUrl();

    $("#subscribe").on("click", async function() {
        await registerServiceWorker();
    });
});

// WebPush
async function registerServiceWorker() {
    if ("serviceWorker" in navigator && "PushManager" in window) {
        try {
            const registration = await navigator.serviceWorker.register("/service-worker.js");
            console.log("Service Worker registered:", registration);
            registration.pushManager.getSubscription().then(async (subscription) => {
                if (!subscription) {
                    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
                    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
                    const newSubscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: convertedVapidKey,
                    });
                    console.log("New subscription:", newSubscription);
                } else {
                    console.log("Existing subscription:", subscription);
                }
                // subscriptionとroomNameを添えてサーバに確認送信
                const roomName = getRoomIdFromUrl();
                io.emit("subscription for web-push", {
                    subscription: subscription || newSubscription,
                    room: roomName
                });
            });
        } catch (error) {
            console.error("Service Worker registration failed:", error);
        }
    } else {
        console.warn("Service Workers are not supported in this browser.");
    }
}

// functions
function getRoomIdFromUrl() {
    const url = new URL(window.location);
    const pathNames = url.pathname.split("/");
    const targetIndex = pathNames.findIndex(segment => segment === "kc") + 1; // kcの隣がroom名
    const roomName = pathNames[targetIndex];
    console.log("room name:", roomName);
    return pathNames;
}