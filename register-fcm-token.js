// Paste the contents of this file into the browser console
// on https://student-dashboard-ashy-rho.vercel.app while logged in

(async function registerToken() {
  var jwt = localStorage.getItem("token");
  if (!jwt) { console.error("Not logged in"); return; }

  var mainSrc = document.querySelector("script[src*=main]").src;
  var text = await fetch(mainSrc).then(function(r){ return r.text(); });

  function extract(key) {
    var idx = text.indexOf(key);
    if (idx === -1) return "";
    var sub = text.slice(idx + key.length, idx + key.length + 120);
    var m = sub.match(/["'`]([^"'`]{10,})["'`]/);
    return m ? m[1] : "";
  }

  var firebaseConfig = {
    apiKey:            extract("apiKey"),
    authDomain:        extract("authDomain"),
    projectId:         extract("projectId"),
    storageBucket:     extract("storageBucket"),
    messagingSenderId: extract("messagingSenderId"),
    appId:             extract("appId")
  };

  var vapidIdx = text.indexOf("vapidKey");
  var vapidSub = text.slice(vapidIdx, vapidIdx + 200);
  var vapidMatch = vapidSub.match(/["'`]([A-Za-z0-9_\-]{80,})["'`]/);
  var vapidKey = vapidMatch ? vapidMatch[1] : "";

  console.log("projectId:", firebaseConfig.projectId);
  console.log("VAPID:", vapidKey.slice(0, 30) + "...");

  var fbAppModule  = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js");
  var fbMsgModule  = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging.js");

  var initializeApp = fbAppModule.initializeApp;
  var getApps       = fbAppModule.getApps;
  var getMessaging  = fbMsgModule.getMessaging;
  var getToken      = fbMsgModule.getToken;

  var apps = getApps();
  var fbApp = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig, "manual");
  console.log("Firebase app:", fbApp.name, fbApp.options.projectId);

  var messaging = getMessaging(fbApp);
  var swReg     = await navigator.serviceWorker.ready;
  console.log("SW scope:", swReg.scope);

  var fcmToken = await getToken(messaging, {
    vapidKey: vapidKey,
    serviceWorkerRegistration: swReg
  });

  if (!fcmToken) { console.error("No FCM token returned"); return; }
  console.log("FCM token:", fcmToken.slice(0, 40) + "...");

  var saveRes  = await fetch("https://student-dashboard-irm9.onrender.com/api/user/save-token", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + jwt,
      "Content-Type":  "application/json"
    },
    body: JSON.stringify({ token: fcmToken })
  });
  var saveData = await saveRes.json();
  console.log("Save result:", saveData);

  if (saveData.success) {
    console.log("Token registered! Now run the test-push fetch.");
  }
})();
