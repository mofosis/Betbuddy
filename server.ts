import express from "express";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Firebase Admin
  try {
    initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log("Firebase Admin initialized");
  } catch (error: any) {
    if (error.code === 'app/duplicate-app') {
      console.log("Firebase Admin already initialized");
    } else {
      console.error("Firebase Admin initialization failed:", error);
    }
  }

  app.use(express.json());

  // API Route for sending push notifications
  app.post("/api/notify", async (req, res) => {
    const { userId, token, title, body, data } = req.body;

    let targetToken = token;

    // We rely on the client passing the token because the backend service account
    // might not have permissions to read Firestore in this environment.
    if (!targetToken) {
      return res.status(400).json({ error: "No token found for user. Notifications must be enabled by the recipient." });
    }

    try {
      const message = {
        notification: {
          title,
          body,
        },
        data: data || {},
        token: targetToken,
      };

      const response = await getMessaging().send(message);
      res.json({ success: true, response });
    } catch (error) {
      console.error("Error sending push notification:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Serve Firebase Messaging Service Worker dynamically
  app.get("/firebase-messaging-sw.js", (req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.send(`
      importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-app-compat.js');
      importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-messaging-compat.js');

      firebase.initializeApp({
        apiKey: "${firebaseConfig.apiKey}",
        authDomain: "${firebaseConfig.authDomain}",
        projectId: "${firebaseConfig.projectId}",
        storageBucket: "${firebaseConfig.storageBucket || ""}",
        messagingSenderId: "${firebaseConfig.messagingSenderId || ""}",
        appId: "${firebaseConfig.appId}"
      });

      const messaging = firebase.messaging();

      messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);
        const notificationTitle = payload.notification.title;
        const notificationOptions = {
          body: payload.notification.body,
          icon: '/firebase-logo.png',
          data: payload.data,
          tag: payload.data?.betId || 'betbuddy-notification',
          actions: payload.data?.betId ? [
            { action: 'view', title: 'Ansehen' }
          ] : []
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
      });

      self.addEventListener('notificationclick', (event) => {
        console.log('[firebase-messaging-sw.js] Notification click Received.');
        event.notification.close();

        const betId = event.notification.data?.betId;
        const urlToOpen = betId ? '/?betId=' + betId : '/';

        event.waitUntil(
          clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
              const client = windowClients[i];
              if (client.url.includes(urlToOpen) && 'focus' in client) {
                return client.focus();
              }
            }
            if (clients.openWindow) {
              return clients.openWindow(urlToOpen);
            }
          })
        );
      });
    `);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
