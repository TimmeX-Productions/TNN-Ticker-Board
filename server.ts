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
    font: '7x13.bdf', image_url: '',
    hardware: { rows: 32, cols: 64, chain_length: 2, parallel: 1, brightness: 90, hardware_mapping: "adafruit-hat-pwm", scan_mode: 0, pwm_bits: 9, pwm_dither_bits: 1, pwm_lsb_nanoseconds: 130, disable_hardware_pulsing: false, inverse_colors: false, show_refresh_rate: false, limit_refresh_rate_hz: 100 },
    runtime: { gpio_slowdown: 4 },
    display_durations: { calendar: 30, hockey_scoreboard: 45, weather: 20, stocks: 25 },
    use_short_date_format: true,
    dynamic_duration: { max_duration_seconds: 60 },
    plugins: {
      time: { enabled: true, format: '12h' },
      weather: { enabled: false, location: '', api_key: '' },
      sports: { enabled: false, teams: '' },
      stocks: { enabled: false, symbols: '' },
      entertainment: { enabled: false, mode: 'game_of_life' }
    }
  }
};

// Load data if exists
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    appData = { ...appData, ...JSON.parse(raw) };
    if (!appData.settings.plugins) {
      appData.settings.plugins = {
        time: { enabled: true, format: '12h' },
        weather: { enabled: false, location: '', api_key: '' },
        sports: { enabled: false, teams: '' },
        stocks: { enabled: false, symbols: '' },
        entertainment: { enabled: false, mode: 'game_of_life' }
      };
    }
    if (!appData.settings.plugins.module_order) {
      appData.settings.plugins.module_order = ['time', 'weather', 'sports', 'stocks', 'news'];
    }
  } catch (e) {
    console.error("Failed to load data.json", e);
  }
}

let saveTimeout: NodeJS.Timeout | null = null;
function saveData() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(appData, null, 2));
  }, 500);
}

let rotationActive = true;
let rotationIndex = -1;
let rotationTimer: NodeJS.Timeout | null = null;
let latestNews = "";

async function getWeatherData(location: string, apiKey: string) {
    if (!location || !apiKey) return "Weather: Not Configured";
    try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}&units=imperial`);
        const data = await res.json() as any;
        if (data.weather) {
            return `Weather in ${data.name}: ${data.weather[0].description}, ${Math.round(data.main.temp)}°F`;
        }
        return "Weather: Invalid API Key or Location";
    } catch (e) {
        return "Weather: Error fetching data";
    }
}

async function getStockData(symbols: string) {
    if (!symbols) return "Stocks: Not Configured";
    try {
        const symbolList = symbols.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
        if (symbolList.length === 0) return "Stocks: No symbols";

        const results = await Promise.all(symbolList.map(async (sym) => {
            try {
                const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1d`);
                if (!res.ok) return null;
                const data = await res.json() as any;
                if (!data.chart || !data.chart.result || data.chart.result.length === 0) return null;
                
                const meta = data.chart.result[0].meta;
                const price = meta.regularMarketPrice;
                const prevClose = meta.chartPreviousClose || meta.previousClose;
                const isPositive = price >= prevClose;
                const trend = isPositive ? '▲' : '▼';
                const colorTag = isPositive ? '{g}' : '{r}';
                
                return `${meta.symbol}: $${price.toFixed(2)} ${colorTag}${trend}{d}`;
            } catch (e) {
                return null;
            }
        }));

        const validResults = results.filter(r => r !== null);
        if (validResults.length === 0) return "Stocks: No data";
        return validResults.join(' | ');
    } catch (e) {
        return "Stocks: Error fetching data";
    }
}

async function getSportsData(teams: string) {
    try {
        const endpoints = [
            'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
            'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
            'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
            'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
            'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
            'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'
        ];

        const allEvents = await Promise.all(endpoints.map(async (url) => {
            try {
                const res = await fetch(url);
                if (!res.ok) return [];
                const data = await res.json() as any;
                return data.events || [];
            } catch (e) {
                return [];
            }
        }));

        const events = allEvents.flat();
        let scores = events.map((e: any) => {
            try {
                const comp = e.competitions[0];
                const home = comp.competitors.find((c: any) => c.homeAway === 'home');
                const away = comp.competitors.find((c: any) => c.homeAway === 'away');
                const status = e.status.type.shortDetail; // e.g. "Final", "3rd Qtr", "12:00 PM"
                
                return `${away.team.abbreviation} ${away.score} @ ${home.team.abbreviation} ${home.score} (${status})`;
            } catch (err) {
                return null;
            }
        }).filter(s => s !== null);

        if (teams) {
            const teamList = teams.split(',').map(t => t.trim().toUpperCase()).filter(t => t);
            if (teamList.length > 0) {
                scores = scores.filter((s: string) => teamList.some(t => s.includes(t)));
            }
        }
        
        if (scores.length === 0) return "Sports: No games today for selected teams";
        return scores.join(' | ');
    } catch (e) {
        return "Sports: Error fetching data";
    }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  const PORT = 3000;

  async function processRotation() {
      if (!rotationActive) return;
      
      const plugins = appData.settings.plugins as any;
      const order = plugins.module_order || ['time', 'weather', 'sports', 'stocks', 'news'];
      
      const enabled = order.filter((m: string) => {
          if (m === 'news') return appData.feeds.length > 0;
          return plugins[m]?.enabled;
      });

      if (enabled.length === 0) {
          rotationTimer = setTimeout(processRotation, 5000);
          return;
      }

      rotationIndex = (rotationIndex + 1) % enabled.length;
      const currentModule = enabled[rotationIndex];
      let message = "";

      try {
          if (currentModule === 'time') {
              const format = plugins.time?.format === '24h' ? 'en-GB' : 'en-US';
              const options: any = {};
              if (plugins.time?.timezone) options.timeZone = plugins.time.timezone;
              message = new Date().toLocaleTimeString(format, options);
          } else if (currentModule === 'weather') {
              message = await getWeatherData(plugins.weather?.location, plugins.weather?.api_key);
          } else if (currentModule === 'stocks') {
              message = await getStockData(plugins.stocks?.symbols);
          } else if (currentModule === 'news') {
              message = latestNews || "News: No recent updates";
          } else if (currentModule === 'sports') {
              message = await getSportsData(plugins.sports?.teams); 
          } else if (currentModule === 'entertainment') {
              message = "Enjoy the Matrix!";
          }
      } catch (e) {
          message = `Error loading ${currentModule}`;
      }

      if (message) {
          io.emit("display-message", message);
      }
      
      let durationSeconds = 15;
      if (plugins[currentModule] && plugins[currentModule].duration) {
          durationSeconds = parseInt(plugins[currentModule].duration);
      }
      if (isNaN(durationSeconds) || durationSeconds < 1) durationSeconds = 15;
      
      rotationTimer = setTimeout(processRotation, durationSeconds * 1000);
  }

  // Fetch RSS periodically
  async function fetchNews() {
    let allNews: string[] = [];
    for (const feedUrl of appData.feeds) {
      try {
        const feed = await parser.parseURL(feedUrl);
        // Get top 3 items from each feed
        const items = feed.items.slice(0, 3);
        items.forEach(item => {
            if (item.title) {
                allNews.push(`${feed.title ? feed.title + ': ' : ''}${item.title}`);
            }
        });
        
        if (feed.items[0]) {
            io.emit("news-update", { title: feed.items[0].title, image: feed.items[0].enclosure?.url || "" });
        }
      } catch (error) {
        console.error(`Error fetching RSS ${feedUrl}:`, error);
      }
    }
    
    if (allNews.length > 0) {
        latestNews = allNews.join(' | ');
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
    socket.on("system-status", (status) => {
      io.emit("system-status", status);
    });
    socket.on("connection-status", (status) => {
      io.emit("connection-status", status);
    });
    socket.on("client-error", (err) => {
      io.emit("status-update", { type: "error", message: `Pi Error: ${err}` });
    });
    
    socket.on("start-rotation", () => {
      rotationActive = true;
      rotationIndex = -1;
      if (rotationTimer) clearTimeout(rotationTimer);
      processRotation();
      io.emit("rotation-status", true);
    });

    socket.on("stop-rotation", () => {
      rotationActive = false;
      if (rotationTimer) clearTimeout(rotationTimer);
      io.emit("rotation-status", false);
    });

    socket.on("send-message", (message) => {
      rotationActive = false;
      if (rotationTimer) clearTimeout(rotationTimer);
      io.emit("rotation-status", false);
      io.emit("display-message", message);
      socket.emit("status-update", { type: "success", message: "Message sent to matrix" });
    });
    
    socket.on("update-settings", (settings) => {
        appData.settings = settings;
        saveData();
        socket.broadcast.emit("update-settings", settings);
    });

    socket.on("connect-wifi", (data) => {
      io.emit("request-connect-wifi", data);
      io.emit("connection-status", { type: 'wifi', status: 'connecting', message: `Connecting to ${data.ssid}...` });
    });
    socket.on("pair-bluetooth", (data) => {
      io.emit("request-pair-bluetooth", data);
      io.emit("connection-status", { type: 'bluetooth', status: 'pairing', message: `Pairing with ${data.device}...` });
    });
    socket.on("enable-bt-pan", () => {
      io.emit("request-enable-bt-pan");
      socket.emit("status-update", { type: "info", message: "Enabling Bluetooth Hotspot..." });
    });
    socket.on("toggle-bt-config", (enabled) => {
      io.emit("toggle-bt-config", enabled);
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
    processRotation(); // Start rotation loop automatically
  });
}

startServer();

