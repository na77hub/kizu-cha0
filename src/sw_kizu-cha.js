// https://zenn.dev/akinoringo/articles/423fac6b4f6872
self.addEventListener('push', event => {
    const payload = event.data ? event.data.text() : "（ペイロードなし）";
    //console.log('Received push payload:', payload); // ★このログを開発者ツールで確認    
    const options = {
        body: event.data.text(),
        icon: "/image/favicon-128x128.png",  // 任意: アイコン画像のパス
        badge: "/image/favicon-128x128.png"  // 任意: バッジ画像のパス
        //actions: [ // ボタンも設定できるっぽい（https://qiita.com/zaru/items/0d730e825a6b07db0d9b）
        //    {action: "ほげ", title: "開くぅ"},
        //    {action: "ふが", title: "閉じるる"}
        //]
    };
    
    event.waitUntil(
        self.registration.showNotification('kizu-cha0', options)
    );
});
