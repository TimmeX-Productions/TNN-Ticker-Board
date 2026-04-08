import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import Parser from "rss-parser";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parser = new Parser();
const DATA_FILE = path.join(__dirname, "data.json");

// Default data structure
let appData = {
  feeds: ["https://www.espn.com/espn/rss/news"],
  presets: {} as Record<string, any>,
  settings: {
    brightness: 100, color: '#ffffff', speed: 50, mode: 'scroll',
    hardware: { rows: 32, cols: 64, chain_length: 2, parallel: 1, brightness: 90, hardware_mapping: "adafruit-hat-pwm", scan_mode: 0, pwm_bits: 9, pwm_dither_bits: 1, pwm_lsb_nanoseconds: 130, disable_hardware_pulsing: false, inverse_colors: false, show_refresh_rate: false, limit_refresh_rate_hz: 100 },
    runtime: { gpio_slowdown: 4 },
    display_durations: { calendar: 30, hockey_scoreboard: 45, weather: 20, stocks: 25 },
    use_short_date_format: true,
    dynamic_duration: { max_duration_seconds: 60 }
  }
};

// Load data if exists
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    appData = { ...appData, ...JSON.parse(raw) };
  } catch (e) {
    console.error("Failed to load data.json", e);
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(appData, null, 2));
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  const PORT = 3000;

  // Fetch RSS periodically
  async function fetchNews() {
    for (const feedUrl of appData.feeds) {
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
    // Send initial state
    socket.emit("feed-list", appData.feeds);
    socket.emit("preset-list", Object.keys(appData.presets));
    socket.emit("update-settings", appData.settings);
    
    socket.on("add-feed", (feed) => { 
        if (!appData.feeds.includes(feed)) {
            appData.feeds.push(feed); 
            saveData();
            io.emit("feed-list", appData.feeds); 
        }
    });
    socket.on("remove-feed", (feed) => { 
        appData.feeds = appData.feeds.filter(f => f !== feed); 
        saveData();
        io.emit("feed-list", appData.feeds); 
    });
    
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
    
    socket.on("update-settings", (settings) => {
        appData.settings = settings;
        saveData();
        io.emit("update-settings", settings);
    });

    socket.on("connect-wifi", (data) => {
      io.emit("request-connect-wifi", data);
      io.emit("connection-status", { type: 'wifi', status: 'connecting', message: `Connecting to ${data.ssid}...` });
    });
    socket.on("pair-bluetooth", (data) => {
      io.emit("request-pair-bluetooth", data);
      io.emit("connection-status", { type: 'bluetooth', status: 'pairing', message: `Pairing with ${data.device}...` });
    });

    // Presets
    socket.on("save-preset", (data) => {
      appData.presets[data.name] = data.settings;
      saveData();
      io.emit("preset-list", Object.keys(appData.presets));
      socket.emit("status-update", { type: "success", message: `Preset '${data.name}' saved` });
    });
    socket.on("load-preset", (name) => {
      if (appData.presets[name]) {
        appData.settings = appData.presets[name];
        saveData();
        io.emit("update-settings", appData.settings);
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

