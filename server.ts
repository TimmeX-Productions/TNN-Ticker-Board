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
const defaultSettings = {
  brightness: 100, color: '#ffffff', speed: 50, mode: 'scroll', effect: 'scroll',
  font: '7x13.bdf', image_url: '', font_y_offset: 0,
  schedule: { enabled: false, day_brightness: 100, night_brightness: 20, night_start: '22:00', night_end: '07:00' },
  hardware: { rows: 32, cols: 64, chain_length: 2, parallel: 1, brightness: 90, hardware_mapping: "adafruit-hat-pwm", scan_mode: 0, pwm_bits: 9, pwm_dither_bits: 1, pwm_lsb_nanoseconds: 130, disable_hardware_pulsing: false, inverse_colors: false, show_refresh_rate: false, limit_refresh_rate_hz: 100 },
  runtime: { gpio_slowdown: 4 },
  plugins: {
    module_order: ['time', 'weather', 'sports', 'stocks', 'crypto', 'news'],
    time: { enabled: true, format: '12h', duration: 15 },
    weather: { enabled: false, location: '', api_key: '', duration: 15 },
    sports: { enabled: false, teams: '', leagues: { NFL: true, NBA: true, MLB: true, NHL: true, NCAAF: false, NCAAB: false, NCAAW: false, NCAABS: false, NCAAH: false, WNBA: false, MLS: false, EPL: false, UCL: false, LIGA: false }, duration: 20 },
    stocks: { enabled: false, symbols: '', duration: 20 },
    crypto: { enabled: false, symbols: 'BTC,ETH,DOGE', duration: 20 },
    news: { enabled: false, duration: 30 },
    entertainment: { enabled: false, mode: 'game_of_life', duration: 30 }
  }
};

let appData = {
  feeds: ["https://www.espn.com/espn/rss/news"],
  presets: {} as Record<string, any>,
  settings: JSON.parse(JSON.stringify(defaultSettings))
};

// Deep merge helper
function deepMerge(target: any, source: any) {
  for (const key of Object.keys(source)) {
    if (Array.isArray(source[key])) {
      if (key === 'module_order' && Array.isArray(target[key])) {
        // Deduplicate and append any new default modules
        target[key] = Array.from(new Set([...source[key], ...target[key]]));
      } else {
        target[key] = source[key];
      }
    } else if (source[key] !== null && typeof source[key] === 'object') {
      if (target[key] !== null && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        target[key] = deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Load data if exists
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const loadedData = JSON.parse(raw);
    
    // Merge feeds and presets
    if (loadedData.feeds) appData.feeds = loadedData.feeds;
    if (loadedData.presets) appData.presets = loadedData.presets;
    
    // Deep merge settings to preserve new defaults
    if (loadedData.settings) {
      appData.settings = deepMerge(JSON.parse(JSON.stringify(defaultSettings)), loadedData.settings);
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

const systemLogs: {timestamp: string, level: string, message: string, source: string}[] = [];
const MAX_LOGS = 100;

function addLog(level: string, message: string, source: string = 'server') {
  const log = { timestamp: new Date().toISOString(), level, message, source };
  systemLogs.unshift(log);
  if (systemLogs.length > MAX_LOGS) systemLogs.pop();
  console.log(`[${source}] ${level.toUpperCase()}: ${message}`);
  // We will emit this via socket later when we have the io instance
}

let rotationActive = true;
let rotationIndex = -1;
let rotationTimer: NodeJS.Timeout | null = null;
let latestNews = "";

async function getWeatherData(location: string, apiKey: string) {
    if (!location || !apiKey) return "Weather: Not Configured";
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}&units=imperial`, { signal: controller.signal });
        clearTimeout(timeoutId);
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
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1d`, { signal: controller.signal });
                clearTimeout(timeoutId);
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

async function getSportsData(teams: string, leagues: any) {
    try {
        const endpoints: {url: string, prefix: string, enabled: boolean}[] = [
            { url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', prefix: 'NFL', enabled: leagues?.NFL !== false },
            { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', prefix: 'NBA', enabled: leagues?.NBA !== false },
            { url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard', prefix: 'MLB', enabled: leagues?.MLB !== false },
            { url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard', prefix: 'NHL', enabled: leagues?.NHL !== false },
            { url: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard', prefix: 'NCAAF', enabled: leagues?.NCAAF === true },
            { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard', prefix: 'NCAAB', enabled: leagues?.NCAAB === true },
            { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard', prefix: 'NCAAW', enabled: leagues?.NCAAW === true },
            { url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/scoreboard', prefix: 'NCAABS', enabled: leagues?.NCAABS === true },
            { url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/scoreboard', prefix: 'NCAAH', enabled: leagues?.NCAAH === true },
            { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard', prefix: 'WNBA', enabled: leagues?.WNBA === true },
            { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard', prefix: 'MLS', enabled: leagues?.MLS === true },
            { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard', prefix: 'EPL', enabled: leagues?.EPL === true },
            { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard', prefix: 'UCL', enabled: leagues?.UCL === true },
            { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard', prefix: 'LIGA', enabled: leagues?.LIGA === true }
        ];

        const activeEndpoints = endpoints.filter(e => e.enabled);
        if (activeEndpoints.length === 0) return "Sports: No leagues enabled";

        const allEvents = await Promise.all(activeEndpoints.map(async (ep) => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                const res = await fetch(ep.url, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!res.ok) return [];
                const data = await res.json() as any;
                return (data.events || []).map((e: any) => ({ ...e, _prefix: ep.prefix }));
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
                
                const homeScore = parseInt(home.score) || 0;
                const awayScore = parseInt(away.score) || 0;
                
                // Color winning team green, losing team red (if game has started/finished)
                const isStarted = e.status.type.state !== 'pre';
                const homeColor = isStarted ? (homeScore > awayScore ? '{g}' : (homeScore < awayScore ? '{r}' : '{w}')) : '{w}';
                const awayColor = isStarted ? (awayScore > homeScore ? '{g}' : (awayScore < homeScore ? '{r}' : '{w}')) : '{w}';
                
                const homeLogoUrl = home.team.logo || '';
                const awayLogoUrl = away.team.logo || '';
                
                const homeLogo = homeLogoUrl ? `{img:${homeLogoUrl}${homeLogoUrl.includes('?') ? '&' : '?'}w=24&h=24}` : '';
                const awayLogo = awayLogoUrl ? `{img:${awayLogoUrl}${awayLogoUrl.includes('?') ? '&' : '?'}w=24&h=24}` : '';
                
                return `{y}[${e._prefix}]{d} ${awayLogo}${awayColor}${away.team.abbreviation} ${away.score}{d} @ ${homeLogo}${homeColor}${home.team.abbreviation} ${home.score}{d} ({y}${status}{d})`;
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
        
        if (scores.length === 0) return "Sports: No games today for selected teams/leagues";
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
      try {
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
                  message = await getSportsData(plugins.sports?.teams, plugins.sports?.leagues); 
              } else if (currentModule === 'crypto') {
                  message = await getStockData(plugins.crypto?.symbols?.split(',').map((s: string) => s.trim() + '-USD').join(','));
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
      } catch (err) {
          console.error("Critical error in rotation loop:", err);
          rotationTimer = setTimeout(processRotation, 10000); // Try again in 10s
      }
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
    socket.emit("rotation-status", rotationActive);
    
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
    socket.on("scan-wifi", () => {
      io.emit("request-scan-wifi");
      socket.emit("status-update", { type: "info", message: "Scanning for Wi-Fi networks..." });
    });
    socket.on("pair-bluetooth", (data) => {
      io.emit("request-pair-bluetooth", data);
      io.emit("connection-status", { type: 'bluetooth', status: 'pairing', message: `Pairing with ${data.name || data.device}...` });
    });
    socket.on("scan-bluetooth", () => {
      io.emit("request-scan-bluetooth");
      socket.emit("status-update", { type: "info", message: "Scanning for Bluetooth devices..." });
    });
    socket.on("enable-bt-pan", () => {
      io.emit("request-enable-bt-pan");
      socket.emit("status-update", { type: "info", message: "Enabling Bluetooth Hotspot..." });
    });
    socket.on("toggle-bt-config", (enabled) => {
      io.emit("toggle-bt-config", enabled);
    });

    socket.on("refresh-data", async () => {
      socket.emit("status-update", { type: "info", message: "Refreshing all module data..." });
      await fetchNews();
      if (rotationActive) {
          if (rotationTimer) clearTimeout(rotationTimer);
          processRotation();
      }
      socket.emit("status-update", { type: "success", message: "Data refresh complete" });
    });

    socket.on("restart-matrix", () => {
      io.emit("request-restart-matrix");
      socket.emit("status-update", { type: "info", message: "Restarting matrix display..." });
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

    // Logging
    socket.on("pi-log", (log) => {
      addLog(log.level, log.message, 'pi-client');
      io.emit("new-log", systemLogs[0]);
    });
    
    socket.on("get-logs", () => {
      socket.emit("logs-list", systemLogs);
    });
  });

  // Modify addLog to emit if io is ready
  const originalAddLog = addLog;
  (global as any).addLog = function(level: string, message: string, source: string = 'server') {
    const log = { timestamp: new Date().toISOString(), level, message, source };
    systemLogs.unshift(log);
    if (systemLogs.length > MAX_LOGS) systemLogs.pop();
    console.log(`[${source}] ${level.toUpperCase()}: ${message}`);
    if (io) {
      io.emit("new-log", log);
    }
  };

  app.use('/pi_client', express.static(path.join(process.cwd(), 'pi_client')));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (req.path.startsWith('/pi_client')) return; // Let static handle it
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    fetchNews();
    processRotation(); // Start rotation loop automatically
  });
}

startServer();

