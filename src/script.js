// script.js
import $ from "jquery";

$(function() {

    // ブラウザのディベロッパーツールのコンソールに表示されます
    console.log(`VAPID_PUBLIC_KEY=${import.meta.env.VITE_VAPID_PUBLIC_KEY}`);

    //const elem = document.getElementByID("#room");
    //elem.textContet = "hoge";
    $("#room").text("hoge");

});
