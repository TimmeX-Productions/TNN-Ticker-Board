import React, { useState, useEffect } from 'react';
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
import { Activity, Wifi, Bluetooth, Power, Settings2, Rss, MonitorPlay, Save, Trash2, Send, Image as ImageIcon, Type, Clock, Cloud, Trophy, TrendingUp, Gamepad2, LayoutDashboard, Blocks, Bitcoin, Terminal } from 'lucide-react';
import DisplaySettings from '@/components/DisplaySettings';
import MatrixPreview from '@/components/MatrixPreview';

const socket = io(); 

export default function App() {
  const [activeTab, setActiveTab] = useState('live');
  const [message, setMessage] = useState('');
  const [displayMessage, setDisplayMessage] = useState('Waiting for broadcast...');
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
      module_order: ['time', 'weather', 'sports', 'stocks', 'crypto', 'news'],
      time: { enabled: true, format: '12h' },
      weather: { enabled: false, location: '', api_key: '' },
      sports: { enabled: false, teams: '' },
      stocks: { enabled: false, symbols: '' },
      crypto: { enabled: false, symbols: 'BTC,ETH,DOGE' },
      news: { enabled: false },
      entertainment: { enabled: false, mode: 'game_of_life' }
    }
  });

  const [presets, setPresets] = useState<string[]>([]);
  const [presetName, setPresetName] = useState('');
  const [health, setHealth] = useState({ cpu: 0, temp: 0 });
  const [wifiNetworks, setWifiNetworks] = useState<string[]>([]);
  const [bluetoothDevices, setBluetoothDevices] = useState<{name: string, mac: string}[]>([]);
  const [selectedWifi, setSelectedWifi] = useState('');
  const [selectedBluetooth, setSelectedBluetooth] = useState(''); // This will store the MAC address
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiStatus, setWifiStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');
  const [btStatus, setBtStatus] = useState<'idle' | 'pairing' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [btConfigEnabled, setBtConfigEnabled] = useState(false);
  const [rotationActive, setRotationActive] = useState(false);
  const [logs, setLogs] = useState<{timestamp: string, level: string, message: string, source: string}[]>([]);

  useEffect(() => {
    socket.on('connect', () => {
      setStatus('Connected');
      socket.emit('get-logs');
    });
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
    socket.on('display-message', (data) => setDisplayMessage(data));
    socket.on('logs-list', (data) => setLogs(data));
    socket.on('new-log', (log) => setLogs(prev => [log, ...prev].slice(0, 100)));
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
      socket.off('display-message');
      socket.off('logs-list'); socket.off('new-log');
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
    { id: 'logs', label: 'System Logs', icon: <Terminal className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#001224] text-[#f1faee] font-sans selection:bg-[#e63946]/30 flex flex-col md:flex-row">
      <Toaster theme="dark" />
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#001f3d] border-r border-[#1d3557] flex flex-col shrink-0">
        <div className="p-6 border-b border-[#1d3557] bg-[#e63946]/10">
          <h1 className="text-2xl font-black tracking-tighter text-white flex flex-col gap-1 uppercase italic">
            <span className="text-[#e63946] flex items-center gap-2">
              <MonitorPlay className="w-6 h-6" />
              Timmy
            </span>
            <span className="text-white">News Network</span>
          </h1>
          <div className="mt-4 flex items-center gap-2">
            <Badge variant={status === 'Connected' ? 'default' : 'destructive'} className={status === 'Connected' ? 'bg-[#457b9d]/20 text-[#a8dadc] border-[#457b9d]/30' : 'bg-[#e63946]/20 text-[#e63946] border-[#e63946]/30'}>
              {status}
            </Badge>
          </div>
        </div>
        
        <nav className="p-4 space-y-2 flex-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-none transition-all text-sm font-bold uppercase tracking-wider border-l-4 ${
                activeTab === item.id 
                  ? 'bg-[#e63946]/20 text-white border-[#e63946]' 
                  : 'text-[#a8dadc] border-transparent hover:bg-[#1d3557] hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#1d3557] text-xs text-[#a8dadc]/60 space-y-2 bg-[#001224]/50">
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-tighter">CPU Load</span>
            <span className="text-white font-mono">{health.cpu}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-tighter">Temp</span>
            <span className="text-white font-mono">{health.temp}°C</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-tighter">IP</span>
            <span className="text-white font-mono">{systemStatus.ip_address}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto h-screen bg-[#001224]">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Breaking News Ticker Style Header */}
          <div className="bg-[#e63946] text-white p-2 flex items-center gap-4 overflow-hidden whitespace-nowrap shadow-lg">
            <div className="bg-white text-[#e63946] px-3 py-1 font-black italic uppercase text-sm shrink-0">Breaking</div>
            <div className="animate-marquee inline-block font-bold uppercase tracking-widest text-sm">
              {message || "Welcome to Timmy News Network - Your False News Is Waiting - System Online - Matrix Ready"}
            </div>
          </div>

          {/* Always show Live Preview at the top */}
          <Card className="bg-[#001f3d] border-[#1d3557] shadow-2xl overflow-hidden rounded-none border-t-4 border-t-[#e63946]">
            <CardHeader className="border-b border-[#1d3557] bg-[#001224]/50 py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2 text-lg font-black uppercase italic tracking-tighter">
                  <MonitorPlay className="w-5 h-5 text-[#e63946]" />
                  Live Broadcast
                </CardTitle>
                <CardDescription className="text-[#a8dadc]/60 font-bold uppercase text-[10px] tracking-widest">Real-time simulation of the LED matrix output.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${rotationActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-600'}`}></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#a8dadc]">{rotationActive ? 'LIVE ROTATION' : 'STATIC MODE'}</span>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <MatrixPreview settings={settings} message={rotationActive ? displayMessage : message} news={news} />
              <div className="mt-4 p-3 bg-[#001224] border border-[#1d3557] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#a8dadc]/50">Current Feed:</span>
                  <span className="text-white font-mono text-xs truncate max-w-[300px]">{rotationActive ? displayMessage : (message || 'No Active Message')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tab Content */}
          {activeTab === 'live' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2 space-y-8">
                <Card className="bg-[#001f3d] border-[#1d3557] rounded-none">
                  <CardContent className="p-6 space-y-8">
                    {/* Message Input */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-[#a8dadc] font-black uppercase italic tracking-tighter">Custom Broadcast</Label>
                        <Button 
                          onClick={() => socket.emit(rotationActive ? 'stop-rotation' : 'start-rotation')} 
                          variant={rotationActive ? "destructive" : "default"} 
                          className={`h-8 px-3 text-xs font-bold uppercase tracking-widest ${!rotationActive ? "bg-[#457b9d] hover:bg-[#1d3557] text-white" : "bg-[#e63946] hover:bg-[#c1121f]"}`}
                        >
                          {rotationActive ? "Stop Rotation" : "Start Rotation"}
                        </Button>
                      </div>
                      <form onSubmit={sendMessage} className="flex gap-3">
                        <Input 
                          value={message} 
                          onChange={(e) => setMessage(e.target.value)} 
                          placeholder="Enter breaking news..." 
                          className="bg-[#001224] border-[#1d3557] text-white h-12 text-lg focus-visible:ring-[#e63946] rounded-none"
                        />
                        <Button type="submit" className="h-12 px-6 bg-[#e63946] hover:bg-[#c1121f] text-white rounded-none font-bold uppercase italic">
                          <Send className="w-4 h-4 mr-2" /> Broadcast
                        </Button>
                        <Button type="button" variant="outline" onClick={clearMatrix} className="h-12 border-[#1d3557] hover:bg-[#1d3557] text-[#a8dadc] rounded-none font-bold uppercase">
                          Clear
                        </Button>
                      </form>
                    </div>

                    <Separator className="bg-[#1d3557]" />

                    {/* Advanced Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-4">
                        <Label className="text-[#a8dadc] flex items-center gap-2 font-bold uppercase text-xs tracking-widest"><Type className="w-4 h-4 text-[#e63946]"/> Typography</Label>
                        <Select value={settings.font || '7x13.bdf'} onValueChange={(v) => sendSettings({...settings, font: v})}>
                          <SelectTrigger className="bg-[#001224] border-[#1d3557] text-white rounded-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#001f3d] border-[#1d3557] text-white">
                            <SelectItem value="4x6.bdf">4x6 (Tiny)</SelectItem>
                            <SelectItem value="5x8.bdf">5x8 (Small)</SelectItem>
                            <SelectItem value="6x10.bdf">6x10 (Medium-Small)</SelectItem>
                            <SelectItem value="7x13.bdf">7x13 (Default)</SelectItem>
                            <SelectItem value="8x13.bdf">8x13 (Medium-Large)</SelectItem>
                            <SelectItem value="9x18.bdf">9x18 (Large)</SelectItem>
                            <SelectItem value="10x20.bdf">10x20 (Extra Large)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-4">
                        <Label className="text-[#a8dadc] flex items-center gap-2 font-bold uppercase text-xs tracking-widest"><MonitorPlay className="w-4 h-4 text-[#e63946]"/> Animation</Label>
                        <Select value={settings.effect || 'scroll'} onValueChange={(v) => sendSettings({...settings, effect: v})}>
                          <SelectTrigger className="bg-[#001224] border-[#1d3557] text-white rounded-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#001f3d] border-[#1d3557] text-white">
                            <SelectItem value="scroll">Smooth Scroll</SelectItem>
                            <SelectItem value="static">Static</SelectItem>
                            <SelectItem value="bounce">Bounce</SelectItem>
                            <SelectItem value="flash">Flash</SelectItem>
                            <SelectItem value="typewriter">Typewriter</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-4">
                        <Label className="text-[#a8dadc] flex items-center gap-2 font-bold uppercase text-xs tracking-widest"><Clock className="w-4 h-4 text-[#e63946]"/> Night Mode</Label>
                        <div className="flex items-center space-x-2 bg-[#001224] border border-[#1d3557] rounded-none p-2">
                          <Switch 
                            id="schedule-toggle"
                            checked={settings.schedule?.enabled || false}
                            onCheckedChange={(c) => sendSettings({...settings, schedule: {...(settings.schedule || {}), enabled: c}})}
                            className="data-[state=checked]:bg-[#e63946]"
                          />
                          <Label htmlFor="schedule-toggle" className="text-xs font-bold uppercase text-[#a8dadc] cursor-pointer">Auto-Dim</Label>
                        </div>
                      </div>
                    </div>

                    <Separator className="bg-[#1d3557]" />

                    {/* Quick Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <Label className="text-[#a8dadc] font-bold uppercase text-xs tracking-widest">Brightness</Label>
                          <span className="text-white font-mono text-sm">{settings.schedule?.enabled ? settings.schedule?.day_brightness : settings.brightness ?? 100}%</span>
                        </div>
                        <Slider 
                          value={[settings.schedule?.enabled ? (settings.schedule?.day_brightness ?? 100) : (settings.brightness ?? 100)]} 
                          min={0} max={100} 
                          onValueChange={(v) => {
                            const val = v[0];
                            if (settings.schedule?.enabled) {
                              sendSettings({...settings, schedule: {...settings.schedule, day_brightness: val}});
                            } else {
                              setSettings({...settings, brightness: val});
                              sendSettings({...settings, brightness: val});
                            }
                          }}
                          className="[&_[role=slider]]:bg-[#e63946] [&_[role=slider]]:border-white"
                        />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <Label className="text-[#a8dadc] font-bold uppercase text-xs tracking-widest">Speed</Label>
                          <span className="text-white font-mono text-sm">{settings.speed ?? 50}</span>
                        </div>
                        <Slider 
                          value={[settings.speed ?? 50]} 
                          min={0} max={100} 
                          onValueChange={(v) => {
                            const val = v[0];
                            setSettings({...settings, speed: val});
                            sendSettings({...settings, speed: val});
                          }}
                          className="[&_[role=slider]]:bg-[#e63946] [&_[role=slider]]:border-white"
                        />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <Label className="text-[#a8dadc] font-bold uppercase text-xs tracking-widest">Y-Offset</Label>
                          <span className="text-white font-mono text-sm">{settings.font_y_offset ?? 0}px</span>
                        </div>
                        <Slider 
                          value={[settings.font_y_offset ?? 0]} 
                          min={-32} max={32} 
                          onValueChange={(v) => {
                            const val = v[0];
                            setSettings({...settings, font_y_offset: val});
                            sendSettings({...settings, font_y_offset: val});
                          }}
                          className="[&_[role=slider]]:bg-[#e63946] [&_[role=slider]]:border-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-4 md:col-span-3">
                      <Label className="text-[#a8dadc] font-bold uppercase text-xs tracking-widest">Broadcast Color</Label>
                      <div className="flex gap-3">
                        <Input 
                          type="color" 
                          value={settings.color} 
                          onChange={(e) => sendSettings({...settings, color: e.target.value})} 
                          className="h-10 w-20 p-1 bg-[#001224] border-[#1d3557] cursor-pointer rounded-none" 
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-8">
                {/* Presets */}
                <Card className="bg-[#001f3d] border-[#1d3557] rounded-none border-t-4 border-t-[#457b9d]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white flex items-center gap-2 text-lg font-black uppercase italic tracking-tighter">
                      <Save className="w-4 h-4 text-[#457b9d]" />
                      Archives
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input 
                        value={presetName} 
                        onChange={(e) => setPresetName(e.target.value)} 
                        placeholder="Archive name" 
                        className="bg-[#001224] border-[#1d3557] text-white rounded-none"
                      />
                      <Button onClick={() => socket.emit('save-preset', { name: presetName, settings })} className="bg-[#457b9d] hover:bg-[#1d3557] text-white rounded-none font-bold uppercase">Save</Button>
                    </div>
                    <Select onValueChange={(v) => socket.emit('load-preset', v)}>
                      <SelectTrigger className="bg-[#001224] border-[#1d3557] text-white rounded-none">
                        <SelectValue placeholder="Load Archive..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#001f3d] border-[#1d3557] text-white">
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
              <Card className="bg-[#001f3d] border-[#1d3557] rounded-none border-t-4 border-t-[#e63946]">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 text-lg font-black uppercase italic tracking-tighter">
                    <Blocks className="w-5 h-5 text-[#e63946]" />
                    Broadcast Rotation
                  </CardTitle>
                  <CardDescription className="text-[#a8dadc]/60 font-bold uppercase text-[10px] tracking-widest">Set the order and duration for each news segment.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => socket.emit('refresh-data')} className="h-8 border-[#1d3557] hover:bg-[#1d3557] text-[#a8dadc] rounded-none font-bold uppercase">
                      <Activity className="w-4 h-4 mr-2" /> Refresh Data
                    </Button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {(settings.plugins as any).module_order?.map((mod: string, idx: number) => (
                      <div key={`${mod}-${idx}`} className="flex items-center justify-between bg-[#001224] border border-[#1d3557] rounded-none px-4 py-2">
                        <div className="flex items-center gap-3">
                          <span className="text-white capitalize font-black italic w-24 tracking-tighter">{mod}</span>
                          <div className="flex items-center gap-2">
                            <Label className="text-[10px] font-bold uppercase text-[#a8dadc]/50">Duration:</Label>
                            <Input 
                              type="number" 
                              min="1"
                              className="w-20 h-8 bg-[#001f3d] border-[#1d3557] text-white rounded-none font-mono" 
                              value={(settings.plugins as any)[mod]?.duration || 15}
                              onChange={(e) => updatePlugin(mod, 'duration', e.target.value)}
                            />
                            <span className="text-[10px] font-bold uppercase text-[#a8dadc]/50">sec</span>
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
                            className="p-1 text-[#a8dadc] hover:text-[#e63946] hover:bg-[#1d3557] rounded-none disabled:opacity-30"
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
                            className="p-1 text-[#a8dadc] hover:text-[#e63946] hover:bg-[#1d3557] rounded-none disabled:opacity-30"
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
              <Card className="bg-[#001f3d] border-[#1d3557] rounded-none">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2 text-lg font-black uppercase italic tracking-tighter">
                    <Clock className="w-5 h-5 text-[#e63946]" />
                    Time
                  </CardTitle>
                  <Switch checked={settings.plugins?.time?.enabled} onCheckedChange={(c) => updatePlugin('time', 'enabled', c)} className="data-[state=checked]:bg-[#e63946]" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">Format</Label>
                    <Select value={settings.plugins?.time?.format || '12h'} onValueChange={(v) => updatePlugin('time', 'format', v)}>
                      <SelectTrigger className="bg-[#001224] border-[#1d3557] text-white rounded-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#001f3d] border-[#1d3557] text-white">
                        <SelectItem value="12h">12-Hour (AM/PM)</SelectItem>
                        <SelectItem value="24h">24-Hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">Timezone</Label>
                    <Input 
                      placeholder="e.g. America/New_York" 
                      value={settings.plugins?.time?.timezone || ''} 
                      onChange={(e) => updatePlugin('time', 'timezone', e.target.value)}
                      className="bg-[#001224] border-[#1d3557] text-white rounded-none placeholder:text-[#a8dadc]/30"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Weather Module */}
              <Card className="bg-[#001f3d] border-[#1d3557] rounded-none">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2 text-lg font-black uppercase italic tracking-tighter">
                    <Cloud className="w-5 h-5 text-[#e63946]" />
                    Weather
                  </CardTitle>
                  <Switch checked={settings.plugins?.weather?.enabled} onCheckedChange={(c) => updatePlugin('weather', 'enabled', c)} className="data-[state=checked]:bg-[#e63946]" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">Location</Label>
                    <Input 
                      value={settings.plugins?.weather?.location || ''} 
                      onChange={(e) => updatePlugin('weather', 'location', e.target.value)} 
                      placeholder="e.g. New York, US" 
                      className="bg-[#001224] border-[#1d3557] text-white rounded-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">API Key</Label>
                    <Input 
                      type="password"
                      value={settings.plugins?.weather?.api_key || ''} 
                      onChange={(e) => updatePlugin('weather', 'api_key', e.target.value)} 
                      placeholder="OpenWeather Key" 
                      className="bg-[#001224] border-[#1d3557] text-white rounded-none"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Sports Module */}
              <Card className="bg-[#001f3d] border-[#1d3557] rounded-none">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2 text-lg font-black uppercase italic tracking-tighter">
                    <Trophy className="w-5 h-5 text-[#e63946]" />
                    Sports
                  </CardTitle>
                  <Switch checked={settings.plugins?.sports?.enabled} onCheckedChange={(c) => updatePlugin('sports', 'enabled', c)} className="data-[state=checked]:bg-[#e63946]" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">Leagues</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB'].map(league => (
                        <div key={league} className="flex items-center space-x-2">
                          <Switch 
                            id={`league-${league}`}
                            checked={settings.plugins?.sports?.leagues?.[league] !== false} 
                            onCheckedChange={(c) => {
                              const currentLeagues = settings.plugins?.sports?.leagues || {};
                              updatePlugin('sports', 'leagues', { ...currentLeagues, [league]: c });
                            }} 
                            className="data-[state=checked]:bg-[#e63946] scale-75"
                          />
                          <Label htmlFor={`league-${league}`} className="text-[10px] font-bold text-[#a8dadc]">{league}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stocks Module */}
              <Card className="bg-[#001f3d] border-[#1d3557] rounded-none">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2 text-lg font-black uppercase italic tracking-tighter">
                    <TrendingUp className="w-5 h-5 text-[#e63946]" />
                    Stocks
                  </CardTitle>
                  <Switch checked={settings.plugins?.stocks?.enabled} onCheckedChange={(c) => updatePlugin('stocks', 'enabled', c)} className="data-[state=checked]:bg-[#e63946]" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">Tickers</Label>
                    <Input 
                      value={settings.plugins?.stocks?.symbols || ''} 
                      onChange={(e) => updatePlugin('stocks', 'symbols', e.target.value)} 
                      placeholder="AAPL, MSFT, TSLA" 
                      className="bg-[#001224] border-[#1d3557] text-white rounded-none"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Crypto Module */}
              <Card className="bg-[#001f3d] border-[#1d3557] rounded-none">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2 text-lg font-black uppercase italic tracking-tighter">
                    <Bitcoin className="w-5 h-5 text-[#e63946]" />
                    Crypto
                  </CardTitle>
                  <Switch checked={settings.plugins?.crypto?.enabled} onCheckedChange={(c) => updatePlugin('crypto', 'enabled', c)} className="data-[state=checked]:bg-[#e63946]" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">Coins</Label>
                    <Input 
                      value={settings.plugins?.crypto?.symbols || ''} 
                      onChange={(e) => updatePlugin('crypto', 'symbols', e.target.value)} 
                      placeholder="BTC, ETH, DOGE" 
                      className="bg-[#001224] border-[#1d3557] text-white rounded-none"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Entertainment Module */}
              <Card className="bg-[#001f3d] border-[#1d3557] rounded-none">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2 text-lg font-black uppercase italic tracking-tighter">
                    <Gamepad2 className="w-5 h-5 text-[#e63946]" />
                    Entertainment
                  </CardTitle>
                  <Switch checked={settings.plugins?.entertainment?.enabled} onCheckedChange={(c) => updatePlugin('entertainment', 'enabled', c)} className="data-[state=checked]:bg-[#e63946]" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">Mode</Label>
                    <Select value={settings.plugins?.entertainment?.mode || 'game_of_life'} onValueChange={(v) => updatePlugin('entertainment', 'mode', v)}>
                      <SelectTrigger className="bg-[#001224] border-[#1d3557] text-white rounded-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#001f3d] border-[#1d3557] text-white">
                        <SelectItem value="game_of_life">Conway's Game of Life</SelectItem>
                        <SelectItem value="matrix_rain">Matrix Rain</SelectItem>
                        <SelectItem value="pong">Pong Clock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* RSS Feeds */}
              <Card className="bg-[#001f3d] border-[#1d3557] rounded-none flex flex-col h-[300px]">
                <CardHeader className="pb-3 shrink-0">
                  <CardTitle className="text-white flex items-center gap-2 text-lg font-black uppercase italic tracking-tighter">
                    <Rss className="w-5 h-5 text-[#e63946]" />
                    News Feeds
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 space-y-4">
                  <form onSubmit={addFeed} className="flex gap-2 shrink-0">
                    <Input 
                      type="url" 
                      value={newFeed} 
                      onChange={(e) => setNewFeed(e.target.value)} 
                      placeholder="RSS URL" 
                      className="bg-[#001224] border-[#1d3557] text-white rounded-none"
                    />
                    <Button type="submit" className="bg-[#e63946] hover:bg-[#c1121f] text-white rounded-none font-bold uppercase">Add</Button>
                  </form>
                  <ScrollArea className="flex-1 border border-[#1d3557] rounded-none bg-[#001224]/30 p-2">
                    <ul className="space-y-2">
                      {feeds.map((f, index) => (
                        <li key={`${f}-${index}`} className="flex justify-between items-center bg-[#001224] p-2 rounded-none text-xs border border-[#1d3557] group">
                          <span className="truncate pr-4 text-[#a8dadc] font-mono">{f}</span>
                          <Button variant="ghost" size="icon" onClick={() => socket.emit('remove-feed', f)} className="h-6 w-6 text-[#a8dadc] hover:text-[#e63946] hover:bg-[#e63946]/10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
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
              <Card className="bg-[#001f3d] border-[#1d3557] rounded-none border-t-4 border-t-[#e63946]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2 text-lg font-black uppercase italic tracking-tighter">
                    <Settings2 className="w-5 h-5 text-[#e63946]" />
                    Network Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  {/* Wi-Fi */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black uppercase tracking-widest text-[#a8dadc] flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-[#e63946]" /> Wi-Fi Status
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[#a8dadc]">{systemStatus.ip_address}</span>
                        <Badge variant="outline" className="bg-[#001224] text-[#a8dadc] border-[#1d3557] uppercase font-bold text-[10px]">{systemStatus.network}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Select onValueChange={setSelectedWifi}>
                        <SelectTrigger className="bg-[#001224] border-[#1d3557] text-white rounded-none">
                          <SelectValue placeholder="Select Network" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#001f3d] border-[#1d3557] text-white">
                          {wifiNetworks.length > 0 ? (
                            wifiNetworks.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)
                          ) : (
                            <SelectItem value="none" disabled>No networks found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" onClick={() => socket.emit('scan-wifi')} className="border-[#1d3557] hover:bg-[#1d3557] text-[#a8dadc] rounded-none font-bold uppercase">Scan</Button>
                    </div>
                    <div className="flex gap-2">
                      <Input type="password" placeholder="Password" value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} className="bg-[#001224] border-[#1d3557] text-white flex-1 rounded-none" />
                      <Button onClick={() => { setWifiStatus('connecting'); socket.emit('connect-wifi', { ssid: selectedWifi, password: wifiPassword }); }} className="bg-[#e63946] hover:bg-[#c1121f] text-white rounded-none font-bold uppercase">Connect</Button>
                    </div>
                    {wifiStatus !== 'idle' && (
                        <div className={`text-xs p-2 rounded-none border ${wifiStatus === 'success' ? 'bg-emerald-950/30 border-emerald-900 text-emerald-400' : wifiStatus === 'error' ? 'bg-red-950/30 border-red-900 text-red-400' : 'bg-[#001224] border-[#1d3557] text-[#a8dadc]'}`}>
                            {wifiStatus === 'connecting' ? 'Connecting...' : connectionMessage}
                        </div>
                    )}
                  </div>

                  <Separator className="bg-[#1d3557]" />
                  
                  {/* Bluetooth */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black uppercase tracking-widest text-[#a8dadc] flex items-center gap-2">
                        <Bluetooth className="w-4 h-4 text-[#e63946]" /> Bluetooth Status
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => socket.emit('enable-bt-pan')} className="h-6 text-[10px] font-bold uppercase border-[#1d3557] hover:bg-[#1d3557] text-[#a8dadc] rounded-none">Hotspot</Button>
                        <Badge variant="outline" className="bg-[#001224] text-[#a8dadc] border-[#1d3557] uppercase font-bold text-[10px]">{systemStatus.bluetooth}</Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 border border-[#1d3557] rounded-none bg-[#001224]/50">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-bold uppercase text-[#a8dadc]">Config Portal</Label>
                        <p className="text-[10px] text-[#a8dadc]/50 uppercase">Allow phone to configure Wi-Fi</p>
                      </div>
                      <Switch checked={btConfigEnabled} onCheckedChange={(c) => { setBtConfigEnabled(c); socket.emit('toggle-bt-config', c); }} className="data-[state=checked]:bg-[#e63946]" />
                    </div>

                    <div className="flex gap-2">
                      <Select onValueChange={setSelectedBluetooth}>
                        <SelectTrigger className="bg-[#001224] border-[#1d3557] text-white rounded-none">
                          <SelectValue placeholder="Select Device" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#001f3d] border-[#1d3557] text-white">
                          {bluetoothDevices.length > 0 ? (
                            bluetoothDevices.map(d => <SelectItem key={d.mac} value={d.mac}>{d.name}</SelectItem>)
                          ) : (
                            <SelectItem value="none" disabled>No devices found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" onClick={() => socket.emit('scan-bluetooth')} className="border-[#1d3557] hover:bg-[#1d3557] text-[#a8dadc] rounded-none font-bold uppercase">Scan</Button>
                    </div>
                    <Button className="w-full bg-[#e63946] hover:bg-[#c1121f] text-white rounded-none font-bold uppercase italic" onClick={() => { 
                      const device = bluetoothDevices.find(d => d.mac === selectedBluetooth);
                      if (device) {
                        setBtStatus('pairing'); 
                        socket.emit('pair-bluetooth', { mac: device.mac, name: device.name }); 
                      } else {
                        toast.error("Please select a device first");
                      }
                    }}>Pair Device</Button>
                    {btStatus !== 'idle' && (
                        <div className={`text-xs p-2 rounded-none border ${btStatus === 'success' ? 'bg-emerald-950/30 border-emerald-900 text-emerald-400' : btStatus === 'error' ? 'bg-red-950/30 border-red-900 text-red-400' : 'bg-[#001224] border-[#1d3557] text-[#a8dadc]'}`}>
                            {btStatus === 'pairing' ? 'Pairing...' : connectionMessage}
                        </div>
                    )}
                  </div>

                  <Separator className="bg-[#1d3557]" />

                  {/* Power */}
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full border-[#1d3557] hover:bg-[#1d3557] text-[#a8dadc] rounded-none font-bold uppercase" onClick={() => socket.emit('restart-matrix')}>
                      <Activity className="w-4 h-4 mr-2" /> Restart Display Script
                    </Button>
                    <div className="flex gap-3">
                      <Button variant="destructive" className="flex-1 bg-[#e63946]/20 text-[#e63946] hover:bg-[#e63946]/30 border border-[#e63946]/30 rounded-none font-bold uppercase italic" onClick={() => socket.emit('reboot-pi')}>
                        <Power className="w-4 h-4 mr-2" /> Reboot Pi
                      </Button>
                      <Button variant="destructive" className="flex-1 bg-[#e63946]/20 text-[#e63946] hover:bg-[#e63946]/30 border border-[#e63946]/30 rounded-none font-bold uppercase italic" onClick={() => socket.emit('shutdown-pi')}>
                        <Power className="w-4 h-4 mr-2" /> Shutdown Pi
                      </Button>
                    </div>
                  </div>

                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-8">
              <Card className="bg-[#001f3d] border-[#1d3557] rounded-none border-t-4 border-t-[#e63946]">
                <CardHeader className="border-b border-[#1d3557] bg-[#001224]/50 py-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2 text-lg font-black uppercase italic tracking-tighter">
                    <Terminal className="w-5 h-5 text-[#e63946]" />
                    Intelligence Feed
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setLogs([])} className="h-8 border-[#1d3557] hover:bg-[#e63946] hover:text-white text-[#a8dadc] rounded-none font-bold uppercase">
                    Clear Feed
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-[600px] overflow-y-auto p-4 font-mono text-[11px] space-y-1 bg-[#001224]">
                    {logs.length === 0 ? (
                      <div className="text-[#a8dadc]/30 text-center py-20 uppercase font-black italic tracking-widest">No Intelligence Data Available</div>
                    ) : (
                      logs.map((log, i) => (
                        <div key={i} className={`flex gap-3 py-1 border-b border-[#1d3557]/30 group ${
                          log.level === 'error' ? 'text-[#e63946]' : 
                          log.level === 'warning' ? 'text-[#f4a261]' : 
                          log.level === 'success' ? 'text-[#457b9d]' : 
                          'text-[#a8dadc]'
                        }`}>
                          <span className="text-[#a8dadc]/40 shrink-0 w-24">
                            {new Date(log.timestamp).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                          </span>
                          <span className="shrink-0 w-20 uppercase opacity-70 font-bold">[{log.source}]</span>
                          <span className="break-all text-white group-hover:text-[#a8dadc] transition-colors">{log.message}</span>
                        </div>
                      ))
                    )}
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
