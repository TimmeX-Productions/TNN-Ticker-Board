import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast, Toaster } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Activity, Wifi, Bluetooth, Power, Settings2, Rss, MonitorPlay, Save, Trash2, Send, Image as ImageIcon, Type, Clock, Cloud, Trophy, TrendingUp, Gamepad2, LayoutDashboard, Blocks } from 'lucide-react';
import DisplaySettings from '@/components/DisplaySettings';
import MatrixPreview from '@/components/MatrixPreview';

const socket = io(); 

export default function App() {
  const [activeTab, setActiveTab] = useState('live');
  const [message, setMessage] = useState('');
  const [news, setNews] = useState<{ title: string; image: string } | null>(null);
  const [feeds, setFeeds] = useState<string[]>([]);
  const [newFeed, setNewFeed] = useState('');
  const [status, setStatus] = useState('Disconnected');
  const [systemStatus, setSystemStatus] = useState({ network: 'Unknown', ip_address: 'Unknown', bluetooth: 'Unknown' });
  const [settings, setSettings] = useState({ 
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
  });

  const [presets, setPresets] = useState<string[]>([]);
  const [presetName, setPresetName] = useState('');
  const [health, setHealth] = useState({ cpu: 0, temp: 0 });
  const [wifiNetworks, setWifiNetworks] = useState<string[]>([]);
  const [bluetoothDevices, setBluetoothDevices] = useState<string[]>([]);
  const [selectedWifi, setSelectedWifi] = useState('');
  const [selectedBluetooth, setSelectedBluetooth] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiStatus, setWifiStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');
  const [btStatus, setBtStatus] = useState<'idle' | 'pairing' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [btConfigEnabled, setBtConfigEnabled] = useState(false);
  const [rotationActive, setRotationActive] = useState(false);

  useEffect(() => {
    socket.on('connect', () => setStatus('Connected'));
    socket.on('disconnect', () => setStatus('Disconnected'));
    socket.on('news-update', (data) => setNews(data));
    socket.on('feed-list', (data) => setFeeds(data));
    socket.on('system-status', (data) => setSystemStatus(data));
    socket.on('preset-list', (data) => setPresets(data));
    socket.on('health-update', (data) => setHealth(data));
    socket.on('wifi-scan-results', (data) => setWifiNetworks(data));
    socket.on('bluetooth-scan-results', (data) => setBluetoothDevices(data));
    socket.on('update-settings', (data) => setSettings(data));
    socket.on('rotation-status', (data) => setRotationActive(data));
    socket.on('connection-status', (data) => {
        if (data.type === 'wifi') {
            setWifiStatus(data.status);
            setConnectionMessage(data.message);
        } else if (data.type === 'bluetooth') {
            setBtStatus(data.status);
            setConnectionMessage(data.message);
        }
    });
    socket.on('status-update', (data) => {
        if(data.type === 'success') toast.success(data.message);
        else if(data.type === 'error') toast.error(data.message);
        else toast.info(data.message);
    });
    socket.emit('get-health');
    return () => {
      socket.off('connect'); socket.off('disconnect');
      socket.off('news-update'); socket.off('feed-list'); socket.off('system-status');
      socket.off('preset-list'); socket.off('health-update');
      socket.off('wifi-scan-results'); socket.off('bluetooth-scan-results');
      socket.off('update-settings'); socket.off('connection-status'); socket.off('status-update');
    };
  }, []);

  const addFeed = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFeed.trim()) { socket.emit('add-feed', newFeed); setNewFeed(''); }
  };

  const sendSettings = (newSettings: typeof settings) => {
    setSettings(newSettings);
    socket.emit('update-settings', newSettings);
  };

  const updatePlugin = (plugin: keyof typeof settings.plugins, key: string, value: any) => {
    const newSettings = {
      ...settings,
      plugins: {
        ...settings.plugins,
        [plugin]: {
          ...settings.plugins[plugin],
          [key]: value
        }
      }
    };
    sendSettings(newSettings);
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) { socket.emit('send-message', message); }
  };

  const clearMatrix = () => {
    setMessage('');
    socket.emit('send-message', '');
    sendSettings({...settings, image_url: ''});
  };

  const navItems = [
    { id: 'live', label: 'Live Controls', icon: <MonitorPlay className="w-5 h-5" /> },
    { id: 'modules', label: 'Modules', icon: <Blocks className="w-5 h-5" /> },
    { id: 'display', label: 'Display Settings', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'system', label: 'System', icon: <Settings2 className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-orange-500/30 flex flex-col md:flex-row">
      <Toaster theme="dark" />
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <MonitorPlay className="w-6 h-6 text-orange-500" />
            LED Matrix
          </h1>
          <div className="mt-4 flex items-center gap-2">
            <Badge variant={status === 'Connected' ? 'default' : 'destructive'} className={status === 'Connected' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20' : ''}>
              {status}
            </Badge>
          </div>
        </div>
        
        <nav className="p-4 space-y-2 flex-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium ${
                activeTab === item.id 
                  ? 'bg-orange-500/10 text-orange-500' 
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-800 text-xs text-zinc-500 space-y-2">
          <div className="flex items-center justify-between">
            <span>CPU Usage</span>
            <span className="text-zinc-300">{health.cpu}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Temperature</span>
            <span className="text-zinc-300">{health.temp}°C</span>
          </div>
          <div className="flex items-center justify-between">
            <span>IP Address</span>
            <span className="text-zinc-300">{systemStatus.ip_address}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto h-screen">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Always show Live Preview at the top */}
          <Card className="bg-zinc-950 border-zinc-800 shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-zinc-800 bg-zinc-900/50 py-4">
              <CardTitle className="text-zinc-100 flex items-center gap-2 text-lg">
                <MonitorPlay className="w-5 h-5 text-orange-500" />
                Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <MatrixPreview settings={settings} message={message} news={news} />
            </CardContent>
          </Card>

          {/* Tab Content */}
          {activeTab === 'live' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2 space-y-8">
                <Card className="bg-zinc-950 border-zinc-800">
                  <CardContent className="p-6 space-y-8">
                    {/* Message Input */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-zinc-300 font-semibold">Custom Message</Label>
                        <Button 
                          onClick={() => socket.emit(rotationActive ? 'stop-rotation' : 'start-rotation')} 
                          variant={rotationActive ? "destructive" : "default"} 
                          className={`h-8 px-3 text-xs ${!rotationActive ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                        >
                          {rotationActive ? "Stop Module Rotation" : "Start Module Rotation"}
                        </Button>
                      </div>
                      <form onSubmit={sendMessage} className="flex gap-3">
                        <Input 
                          value={message} 
                          onChange={(e) => setMessage(e.target.value)} 
                          placeholder="Type a message to display..." 
                          className="bg-zinc-900 border-zinc-800 text-zinc-100 h-12 text-lg focus-visible:ring-orange-500"
                        />
                        <Button type="submit" className="h-12 px-6 bg-orange-600 hover:bg-orange-700 text-white">
                          <Send className="w-4 h-4 mr-2" /> Send
                        </Button>
                        <Button type="button" variant="outline" onClick={clearMatrix} className="h-12 border-zinc-700 hover:bg-zinc-800">
                          Clear
                        </Button>
                      </form>
                    </div>

                    <Separator className="bg-zinc-800" />

                    {/* Advanced Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <Label className="text-zinc-300 flex items-center gap-2"><ImageIcon className="w-4 h-4"/> Image URL</Label>
                        <Input 
                          value={settings.image_url || ''} 
                          onChange={(e) => sendSettings({...settings, image_url: e.target.value})} 
                          placeholder="https://example.com/image.png" 
                          className="bg-zinc-900 border-zinc-800 text-zinc-100"
                        />
                        <p className="text-xs text-zinc-500">Overrides text if provided. Best with small images.</p>
                      </div>
                      <div className="space-y-4">
                        <Label className="text-zinc-300 flex items-center gap-2"><Type className="w-4 h-4"/> Font</Label>
                        <Select value={settings.font || '7x13.bdf'} onValueChange={(v) => sendSettings({...settings, font: v})}>
                          <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="4x6.bdf">4x6 (Small)</SelectItem>
                            <SelectItem value="5x8.bdf">5x8</SelectItem>
                            <SelectItem value="7x13.bdf">7x13 (Default)</SelectItem>
                            <SelectItem value="9x18.bdf">9x18 (Large)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Separator className="bg-zinc-800" />

                    {/* Quick Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <Label className="text-zinc-300">Brightness</Label>
                          <span className="text-zinc-500 text-sm">{settings.brightness ?? 100}%</span>
                        </div>
                        <Slider 
                          value={settings.brightness ?? 100} 
                          min={0} max={100} 
                          onValueChange={(v) => {
                            const val = Array.isArray(v) ? v[0] : v;
                            setSettings({...settings, brightness: val});
                            sendSettings({...settings, brightness: val});
                          }}
                          className="[&_[role=slider]]:bg-orange-500"
                        />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <Label className="text-zinc-300">Scroll Speed</Label>
                          <span className="text-zinc-500 text-sm">{settings.speed ?? 50}</span>
                        </div>
                        <Slider 
                          value={settings.speed ?? 50} 
                          min={0} max={100} 
                          onValueChange={(v) => {
                            const val = Array.isArray(v) ? v[0] : v;
                            setSettings({...settings, speed: val});
                            sendSettings({...settings, speed: val});
                          }}
                          className="[&_[role=slider]]:bg-orange-500"
                        />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <Label className="text-zinc-300">Font Position (Up/Down)</Label>
                          <span className="text-zinc-500 text-sm">{settings.font_y_offset ?? 0}px</span>
                        </div>
                        <Slider 
                          value={settings.font_y_offset ?? 0} 
                          min={-32} max={32} 
                          onValueChange={(v) => {
                            const val = Array.isArray(v) ? v[0] : v;
                            setSettings({...settings, font_y_offset: val});
                            sendSettings({...settings, font_y_offset: val});
                          }}
                          className="[&_[role=slider]]:bg-orange-500"
                        />
                      </div>
                      <div className="space-y-4 md:col-span-3">
                        <Label className="text-zinc-300">Color & Effect</Label>
                        <div className="flex gap-3">
                          <Input 
                            type="color" 
                            value={settings.color} 
                            onChange={(e) => sendSettings({...settings, color: e.target.value})} 
                            className="h-10 w-20 p-1 bg-zinc-900 border-zinc-800 cursor-pointer" 
                          />
                          <Select value={settings.mode} onValueChange={(v) => sendSettings({...settings, mode: v})}>
                            <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="scroll">Scroll Left</SelectItem>
                              <SelectItem value="static">Static Center</SelectItem>
                              <SelectItem value="bounce">Bounce</SelectItem>
                              <SelectItem value="flash">Flash</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-8">
                {/* Presets */}
                <Card className="bg-zinc-950 border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-zinc-100 flex items-center gap-2 text-lg">
                      <Save className="w-4 h-4 text-orange-500" />
                      Presets
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input 
                        value={presetName} 
                        onChange={(e) => setPresetName(e.target.value)} 
                        placeholder="Preset name" 
                        className="bg-zinc-900 border-zinc-800 text-zinc-100"
                      />
                      <Button onClick={() => socket.emit('save-preset', { name: presetName, settings })} className="bg-zinc-800 hover:bg-zinc-700 text-white">Save</Button>
                    </div>
                    <Select onValueChange={(v) => socket.emit('load-preset', v)}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                        <SelectValue placeholder="Load a preset..." />
                      </SelectTrigger>
                      <SelectContent>
                        {presets.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'modules' && (
            <div className="space-y-6">
              <Card className="bg-zinc-950 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-100 flex items-center gap-2 text-lg">
                    <Blocks className="w-5 h-5 text-orange-500" />
                    Module Rotation Order
                  </CardTitle>
                  <CardDescription className="text-zinc-400">Drag or use arrows to set the order modules appear in rotation, and set how long each module displays.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    {(settings.plugins as any).module_order?.map((mod: string, idx: number) => (
                      <div key={mod} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-md px-4 py-2">
                        <div className="flex items-center gap-3">
                          <span className="text-zinc-300 capitalize font-medium w-24">{mod}</span>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-zinc-500">Duration:</Label>
                            <Input 
                              type="number" 
                              min="1"
                              className="w-20 h-8 bg-zinc-950 border-zinc-800 text-zinc-100" 
                              value={(settings.plugins as any)[mod]?.duration || 15}
                              onChange={(e) => updatePlugin(mod, 'duration', e.target.value)}
                            />
                            <span className="text-xs text-zinc-500">sec (e.g. 60 = 1m)</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            disabled={idx === 0}
                            onClick={() => {
                              const newOrder = [...(settings.plugins as any).module_order];
                              [newOrder[idx], newOrder[idx - 1]] = [newOrder[idx - 1], newOrder[idx]];
                              sendSettings({ ...settings, plugins: { ...settings.plugins, module_order: newOrder } as any });
                            }}
                            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded disabled:opacity-30"
                          >
                            ▲
                          </button>
                          <button 
                            disabled={idx === (settings.plugins as any).module_order.length - 1}
                            onClick={() => {
                              const newOrder = [...(settings.plugins as any).module_order];
                              [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
                              sendSettings({ ...settings, plugins: { ...settings.plugins, module_order: newOrder } as any });
                            }}
                            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded disabled:opacity-30"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* Time Module */}
              <Card className="bg-zinc-950 border-zinc-800">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-zinc-100 flex items-center gap-2 text-lg">
                    <Clock className="w-5 h-5 text-orange-500" />
                    Time
                  </CardTitle>
                  <Switch checked={settings.plugins?.time?.enabled} onCheckedChange={(c) => updatePlugin('time', 'enabled', c)} />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Format</Label>
                    <Select value={settings.plugins?.time?.format || '12h'} onValueChange={(v) => updatePlugin('time', 'format', v)}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12h">12-Hour (AM/PM)</SelectItem>
                        <SelectItem value="24h">24-Hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Timezone</Label>
                    <Input 
                      placeholder="e.g. America/New_York" 
                      value={settings.plugins?.time?.timezone || ''} 
                      onChange={(e) => updatePlugin('time', 'timezone', e.target.value)}
                      className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                    />
                    <p className="text-xs text-zinc-500">Leave blank for local Pi time.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Weather Module */}
              <Card className="bg-zinc-950 border-zinc-800">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-zinc-100 flex items-center gap-2 text-lg">
                    <Cloud className="w-5 h-5 text-orange-500" />
                    Weather
                  </CardTitle>
                  <Switch checked={settings.plugins?.weather?.enabled} onCheckedChange={(c) => updatePlugin('weather', 'enabled', c)} />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Location (City, Country)</Label>
                    <Input 
                      value={settings.plugins?.weather?.location || ''} 
                      onChange={(e) => updatePlugin('weather', 'location', e.target.value)} 
                      placeholder="e.g. New York, US" 
                      className="bg-zinc-900 border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">OpenWeather API Key</Label>
                    <Input 
                      type="password"
                      value={settings.plugins?.weather?.api_key || ''} 
                      onChange={(e) => updatePlugin('weather', 'api_key', e.target.value)} 
                      placeholder="API Key" 
                      className="bg-zinc-900 border-zinc-800 text-zinc-100"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Sports Module */}
              <Card className="bg-zinc-950 border-zinc-800">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-zinc-100 flex items-center gap-2 text-lg">
                    <Trophy className="w-5 h-5 text-orange-500" />
                    Sports
                  </CardTitle>
                  <Switch checked={settings.plugins?.sports?.enabled} onCheckedChange={(c) => updatePlugin('sports', 'enabled', c)} />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Favorite Teams (Comma separated)</Label>
                    <Input 
                      value={settings.plugins?.sports?.teams || ''} 
                      onChange={(e) => updatePlugin('sports', 'teams', e.target.value)} 
                      placeholder="e.g. LAL, NYY, DAL" 
                      className="bg-zinc-900 border-zinc-800 text-zinc-100"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Stocks Module */}
              <Card className="bg-zinc-950 border-zinc-800">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-zinc-100 flex items-center gap-2 text-lg">
                    <TrendingUp className="w-5 h-5 text-orange-500" />
                    Stocks
                  </CardTitle>
                  <Switch checked={settings.plugins?.stocks?.enabled} onCheckedChange={(c) => updatePlugin('stocks', 'enabled', c)} />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Symbols (Comma separated)</Label>
                    <Input 
                      value={settings.plugins?.stocks?.symbols || ''} 
                      onChange={(e) => updatePlugin('stocks', 'symbols', e.target.value)} 
                      placeholder="e.g. AAPL, MSFT, TSLA" 
                      className="bg-zinc-900 border-zinc-800 text-zinc-100"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Entertainment Module */}
              <Card className="bg-zinc-950 border-zinc-800">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-zinc-100 flex items-center gap-2 text-lg">
                    <Gamepad2 className="w-5 h-5 text-orange-500" />
                    Entertainment
                  </CardTitle>
                  <Switch checked={settings.plugins?.entertainment?.enabled} onCheckedChange={(c) => updatePlugin('entertainment', 'enabled', c)} />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Mode</Label>
                    <Select value={settings.plugins?.entertainment?.mode || 'game_of_life'} onValueChange={(v) => updatePlugin('entertainment', 'mode', v)}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="game_of_life">Conway's Game of Life</SelectItem>
                        <SelectItem value="matrix_rain">Matrix Rain</SelectItem>
                        <SelectItem value="pong">Pong Clock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* RSS Feeds */}
              <Card className="bg-zinc-950 border-zinc-800 flex flex-col h-[300px]">
                <CardHeader className="pb-3 shrink-0">
                  <CardTitle className="text-zinc-100 flex items-center gap-2 text-lg">
                    <Rss className="w-5 h-5 text-orange-500" />
                    News Feeds
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 space-y-4">
                  <form onSubmit={addFeed} className="flex gap-2 shrink-0">
                    <Input 
                      type="url" 
                      value={newFeed} 
                      onChange={(e) => setNewFeed(e.target.value)} 
                      placeholder="Add RSS URL" 
                      className="bg-zinc-900 border-zinc-800 text-zinc-100"
                    />
                    <Button type="submit" className="bg-zinc-800 hover:bg-zinc-700 text-white">Add</Button>
                  </form>
                  <ScrollArea className="flex-1 border border-zinc-800 rounded-md bg-zinc-900/30 p-2">
                    <ul className="space-y-2">
                      {feeds.map((f, index) => (
                        <li key={`${f}-${index}`} className="flex justify-between items-center bg-zinc-900 p-2 rounded text-sm border border-zinc-800 group">
                          <span className="truncate pr-4 text-zinc-300">{f}</span>
                          <Button variant="ghost" size="icon" onClick={() => socket.emit('remove-feed', f)} className="h-6 w-6 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                      {feeds.length === 0 && (
                        <div className="text-center text-zinc-500 py-8 text-sm">No feeds added.</div>
                      )}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
            </div>
          )}

          {activeTab === 'display' && (
            <DisplaySettings settings={settings} onSave={sendSettings} />
          )}

          {activeTab === 'system' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Network & System */}
              <Card className="bg-zinc-950 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-zinc-100 flex items-center gap-2 text-lg">
                    <Settings2 className="w-5 h-5 text-orange-500" />
                    System Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  {/* Wi-Fi */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                        <Wifi className="w-4 h-4" /> Wi-Fi
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">{systemStatus.ip_address}</span>
                        <Badge variant="outline" className="bg-zinc-900 text-zinc-400 border-zinc-800">{systemStatus.network}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Select onValueChange={setSelectedWifi}>
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 flex-1">
                          <SelectValue placeholder="Select Network" />
                        </SelectTrigger>
                        <SelectContent>
                          {wifiNetworks.length > 0 ? (
                            wifiNetworks.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)
                          ) : (
                            <SelectItem value="none" disabled>No networks found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" onClick={() => socket.emit('scan-wifi')} className="border-zinc-800 hover:bg-zinc-800">Scan</Button>
                    </div>
                    <div className="flex gap-2">
                      <Input type="password" placeholder="Password" value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} className="bg-zinc-900 border-zinc-800 text-zinc-100 flex-1" />
                      <Button onClick={() => { setWifiStatus('connecting'); socket.emit('connect-wifi', { ssid: selectedWifi, password: wifiPassword }); }} className="bg-zinc-800 hover:bg-zinc-700 text-white">Connect</Button>
                    </div>
                    {wifiStatus !== 'idle' && (
                        <div className={`text-xs p-2 rounded border ${wifiStatus === 'success' ? 'bg-emerald-950/30 border-emerald-900 text-emerald-400' : wifiStatus === 'error' ? 'bg-red-950/30 border-red-900 text-red-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
                            {wifiStatus === 'connecting' ? 'Connecting...' : connectionMessage}
                        </div>
                    )}
                  </div>

                  <Separator className="bg-zinc-800" />
                  
                  {/* Bluetooth */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                        <Bluetooth className="w-4 h-4" /> Bluetooth
                      </span>
                      <Badge variant="outline" className="bg-zinc-900 text-zinc-400 border-zinc-800">{systemStatus.bluetooth}</Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 border border-zinc-800 rounded-md bg-zinc-900/50">
                      <div className="space-y-0.5">
                        <Label className="text-zinc-300">Bluetooth Config Portal</Label>
                        <p className="text-xs text-zinc-500">Allow phone to configure Wi-Fi</p>
                      </div>
                      <Switch checked={btConfigEnabled} onCheckedChange={(c) => { setBtConfigEnabled(c); socket.emit('toggle-bt-config', c); }} />
                    </div>

                    <div className="flex gap-2">
                      <Select onValueChange={setSelectedBluetooth}>
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 flex-1">
                          <SelectValue placeholder="Select Device" />
                        </SelectTrigger>
                        <SelectContent>
                          {bluetoothDevices.length > 0 ? (
                            bluetoothDevices.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)
                          ) : (
                            <SelectItem value="none" disabled>No devices found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" onClick={() => socket.emit('scan-bluetooth')} className="border-zinc-800 hover:bg-zinc-800">Scan</Button>
                    </div>
                    <Button className="w-full bg-zinc-800 hover:bg-zinc-700 text-white" onClick={() => { setBtStatus('pairing'); socket.emit('pair-bluetooth', { device: selectedBluetooth }); }}>Pair Device</Button>
                    {btStatus !== 'idle' && (
                        <div className={`text-xs p-2 rounded border ${btStatus === 'success' ? 'bg-emerald-950/30 border-emerald-900 text-emerald-400' : btStatus === 'error' ? 'bg-red-950/30 border-red-900 text-red-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
                            {btStatus === 'pairing' ? 'Pairing...' : connectionMessage}
                        </div>
                    )}
                  </div>

                  <Separator className="bg-zinc-800" />

                  {/* Power */}
                  <div className="flex gap-3">
                    <Button variant="destructive" className="flex-1 bg-red-950/50 text-red-500 hover:bg-red-900/50 hover:text-red-400 border border-red-900/50" onClick={() => socket.emit('reboot-pi')}>
                      <Power className="w-4 h-4 mr-2" /> Reboot
                    </Button>
                    <Button variant="destructive" className="flex-1 bg-red-950/50 text-red-500 hover:bg-red-900/50 hover:text-red-400 border border-red-900/50" onClick={() => socket.emit('shutdown-pi')}>
                      <Power className="w-4 h-4 mr-2" /> Shutdown
                    </Button>
                  </div>

                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
