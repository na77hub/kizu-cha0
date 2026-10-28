// script.js
import $ from "jquery";
import io from "socket.io-client";

let g_room = null;
let g_socket = null;
let g_subscription = null;

$(async function() {
    g_room = getRoomIdFromUrl();
    $("#room").text(`Room:${g_room}`);

    // 初回読み込み時の状態表示
    await updateWebPushStatusUI();

    // socket.io
    g_socket = io.connect(window.location.origin, {
        "max reconnection attempts": 100,
        query: { room: g_room, uuid: getOrCreateUuid() }
    });
    g_socket.on("connected", () => {
        console.log("socket.io 接続済");
    });

    // event
    $("#subscribe").on("click", async function() {
        await subscribeWebPush();
        await updateWebPushStatusUI(); // 💡状態をUIに反映
    });

    $("#unsubscribe").on("click", async function() {
        await unsubscribeWebPush();
        await updateWebPushStatusUI(); // 💡状態をUIに反映
    });

    // 形式：data = { message: "こんにちは！" }（room は接続時の query で決まる）
    $("#send-web-push").on("click", function() {
        g_socket.emit("send web push to room", {
            message: "こんにちは、kizu-cha ZEROです！"
        });
    });
});

// UIのステータス表示を更新する共通関数
async function updateWebPushStatusUI() {
    const isSubscribed = await isWebPushSubscribed();
    $("#web-push-info").text(`Web Push:${isSubscribed}`);
}

// WebPush
// サービスワーカの登録とWebPushの購読開始
async function subscribeWebPush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.warn("Service Workers are not supported in this browser.");
        return;
    }

    try {
        // 1. サービスワーカーを登録
        const registration = await navigator.serviceWorker.register("./sw_kizu-cha.js");
        console.log("Service Worker registered:", registration);

        // 💡【修正】ここで確実にサービスワーカーが有効（Active）になるのを待つ
        await navigator.serviceWorker.ready;
        console.log("Service Worker is ready and active!");

        // 2. 現在の購読状況を確認（.thenを廃止してawaitに統一）
        g_subscription = await registration.pushManager.getSubscription();

        if (!g_subscription) {
            const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
            const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
            
            // 安全に購読処理を実行
            g_subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey,
            });
            console.log("New subscription:", g_subscription);
        } else {
            console.log("Existing subscription:", g_subscription);
        }

        // subscriptionとroomNameを添えてサーバに確認送信
        g_socket.emit("subscription for web push", {
            subscription: g_subscription,
            room: g_room
        });

    } catch (error) {
        console.error("Service Worker registration or subscription failed:", error);
    }
}

// WebPushの購読終了
async function unsubscribeWebPush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.warn("Service Workers are not supported in this browser.");
        return;
    }

    try {
        const registration = await navigator.serviceWorker.getRegistration("./sw_kizu-cha.js");
        
        if (registration) {
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                const successful = await subscription.unsubscribe();
                if (successful) {
                    console.log("Web Push subscription canceled successfully.");
                    
                    // サーバーへ削除依頼を通知
                    g_socket.emit("unsubscription from web push", {
                        subscription: subscription,
                        room: g_room
                    });
                }
            } else {
                console.log("No existing subscription found to cancel.");
            }

            // 💡【修正点3】通知のON/OFF切り替え目的であれば、Service Worker自体のunregister（削除）は不要です。
            // もし「アプリから完全にサービスワーカーを抹消したい」場合のみ、以下のコメントアウトを解除してください。
            /*
            const unregisterSuccessful = await registration.unregister();
            if (unregisterSuccessful) {
                console.log("Service Worker unregistered successfully.");
            }
            */
        } else {
            console.log("No Service Worker registration found for this path.");
        }

        g_subscription = null;

    } catch (error) {
        console.error("Web Push unsubscription failed:", error);
    }
}

// 現在購読中かチェック
async function isWebPushSubscribed() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.getRegistration("./sw_kizu-cha.js");
        if (!registration) {
            return false; 
        }

        const subscription = await registration.pushManager.getSubscription();
        return subscription !== null;

    } catch (error) {
        console.error("Failed to check Web Push subscription status:", error);
        return false;
    }
}

// functions
// 端末ごとの識別子（localStorage に保存）
function getOrCreateUuid() {
    const key = "kizu-cha-uuid";
    try {
        let uuid = localStorage.getItem(key);
        if (!uuid) {
            uuid = crypto.randomUUID();
            localStorage.setItem(key, uuid);
        }
        return uuid;
    } catch (e) {
        return crypto.randomUUID();
    }
}

function getRoomIdFromUrl() {
    const url = new URL(window.location);
    const pathNames = url.pathname.split("/");
    const targetIndex = pathNames.findIndex(segment => segment === "kc") + 1;
    return pathNames[targetIndex];
}

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
