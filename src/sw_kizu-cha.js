// https://zenn.dev/akinoringo/articles/423fac6b4f6872
self.addEventListener('push', event => {
    // ペイロードは JSON（{title, body, url}）。JSON でない・空の場合も通知は出す
    let data = {};
    if (event.data) {
        const text = event.data.text();
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = { body: text };
        }
    }
    const options = {
        body: data.body || "",
        icon: "/image/favicon-128x128.png",
        badge: "/image/favicon-128x128.png",
        data: { url: data.url || "/" }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'kizu-cha0', options)
    );
});

// 通知クリックでルームのページを開く（既に開いていればそれを前面に出す）
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = new URL(event.notification.data.url, self.location.origin).href;

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
            for (const client of clients) {
                if (client.url === url && "focus" in client) {
                    return client.focus();
                }
            }
            return self.clients.openWindow(url);
        })
    );
});
