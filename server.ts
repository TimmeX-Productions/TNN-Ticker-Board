import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import Parser from "rss-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parser = new Parser();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  const PORT = 3000;
  let feeds: string[] = ["https://www.espn.com/espn/rss/news"];
  let presets: Record<string, any> = {};

  // Fetch RSS periodically
  async function fetchNews() {
    for (const feedUrl of feeds) {
      try {
        const feed = await parser.parseURL(feedUrl);
        const newsItem = feed.items[0];
        if (newsItem) {
          io.emit("news-update", { title: newsItem.title, image: newsItem.enclosure?.url || "" });
        }
      } catch (error) {
        console.error(`Error fetching RSS ${feedUrl}:`, error);
      }
    }
  }

  setInterval(fetchNews, 60000);

  io.on("connection", (socket) => {
    socket.emit("feed-list", feeds);
    
    socket.on("add-feed", (feed) => { feeds.push(feed); io.emit("feed-list", feeds); });
    socket.on("remove-feed", (feed) => { feeds = feeds.filter(f => f !== feed); io.emit("feed-list", feeds); });
    
    // System Management
    socket.on("scan-wifi", () => {
      io.emit("request-scan-wifi");
      socket.emit("status-update", { type: "info", message: "Scanning for Wi-Fi..." });
    });
    socket.on("scan-bluetooth", () => {
      io.emit("request-scan-bluetooth");
      socket.emit("status-update", { type: "info", message: "Scanning for Bluetooth..." });
    });
    
    // Receive results from Pi and emit to dashboard
    socket.on("wifi-scan-results", (results) => {
      io.emit("wifi-scan-results", results);
      io.emit("status-update", { type: "success", message: "Wi-Fi scan complete" });
    });
    socket.on("bluetooth-scan-results", (results) => {
      io.emit("bluetooth-scan-results", results);
      io.emit("status-update", { type: "success", message: "Bluetooth scan complete" });
    });
    
    socket.on("send-message", (message) => {
      io.emit("display-message", message);
      socket.emit("status-update", { type: "success", message: "Message sent to matrix" });
    });
    socket.on("update-settings", (settings) => io.emit("update-settings", settings));

    socket.on("connect-wifi", (data) => {
      io.emit("request-connect-wifi", data);
      socket.emit("status-update", { type: "info", message: `Connecting to ${data.ssid}...` });
    });
    socket.on("pair-bluetooth", (data) => {
      io.emit("request-pair-bluetooth", data);
      socket.emit("status-update", { type: "info", message: `Pairing with ${data.device}...` });
    });

    // Presets
    socket.on("save-preset", (data) => {
      presets[data.name] = data.settings;
      io.emit("preset-list", Object.keys(presets));
      socket.emit("status-update", { type: "success", message: `Preset '${data.name}' saved` });
    });
    socket.on("load-preset", (name) => {
      if (presets[name]) {
        io.emit("update-settings", presets[name]);
        socket.emit("status-update", { type: "success", message: `Preset '${name}' loaded` });
      }
    });

    // Power Management
    socket.on("reboot-pi", () => {
      io.emit("request-reboot");
      socket.emit("status-update", { type: "info", message: "Rebooting Pi..." });
    });
    socket.on("shutdown-pi", () => {
      io.emit("request-shutdown");
      socket.emit("status-update", { type: "info", message: "Shutting down Pi..." });
    });

    // Detailed Health
    socket.on("get-health", () => {
      io.emit("request-health");
    });
    socket.on("health-update", (health) => {
      io.emit("health-update", health);
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    fetchNews();
  });
}

startServer();
