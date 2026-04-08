import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast, Toaster } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Activity, Wifi, Bluetooth, Power, Settings2, Rss, MonitorPlay, Save, Trash2, Send } from 'lucide-react';
import DisplaySettings from '@/components/DisplaySettings';
import MatrixPreview from '@/components/MatrixPreview';

const socket = io(); 

export default function App() {
  const [message, setMessage] = useState('');
  const [news, setNews] = useState<{ title: string; image: string } | null>(null);
  const [feeds, setFeeds] = useState<string[]>([]);
  const [newFeed, setNewFeed] = useState('');
  const [status, setStatus] = useState('Disconnected');
  const [systemStatus, setSystemStatus] = useState({ network: 'Unknown', bluetooth: 'Unknown' });
  const [settings, setSettings] = useState({ 
    brightness: 100, color: '#ffffff', speed: 50, mode: 'scroll',
    hardware: { rows: 32, cols: 64, chain_length: 2, parallel: 1, brightness: 90, hardware_mapping: "adafruit-hat-pwm", scan_mode: 0, pwm_bits: 9, pwm_dither_bits: 1, pwm_lsb_nanoseconds: 130, disable_hardware_pulsing: false, inverse_colors: false, show_refresh_rate: false, limit_refresh_rate_hz: 100 },
    runtime: { gpio_slowdown: 4 },
    display_durations: { calendar: 30, hockey_scoreboard: 45, weather: 20, stocks: 25 },
    use_short_date_format: true,
    dynamic_duration: { max_duration_seconds: 60 }
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

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) { socket.emit('send-message', message); }
  };

  const clearMatrix = () => {
    setMessage('');
    socket.emit('send-message', '');
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 md:p-8 font-sans selection:bg-orange-500/30">
      <Toaster theme="dark" />
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <MonitorPlay className="w-8 h-8 text-orange-500" />
            Matrix Controller
          </h1>
          <p className="text-zinc-400 mt-1">Professional LED Matrix Management</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant={status === 'Connected' ? 'default' : 'destructive'} className={status === 'Connected' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20' : ''}>
            {status}
          </Badge>
          <div className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800">
            <Activity className="w-4 h-4 text-orange-500" />
            CPU: {health.cpu}% | {health.temp}°C
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Column - Main Controls & Preview */}
        <div className="xl:col-span-8 space-y-8">
          
          {/* Live Preview */}
          <Card className="bg-zinc-950 border-zinc-800 shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-zinc-800 bg-zinc-900/50">
              <CardTitle className="text-zinc-100 flex items-center gap-2">
                <MonitorPlay className="w-5 h-5 text-orange-500" />
                Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <MatrixPreview settings={settings} message={message} news={news} />
            </CardContent>
          </Card>

          {/* Settings Tabs */}
          <Tabs defaultValue="live" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
              <TabsTrigger value="live" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">Live Controls</TabsTrigger>
              <TabsTrigger value="display" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">Display Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="live" className="mt-6">
              <Card className="bg-zinc-950 border-zinc-800">
                <CardContent className="p-6 space-y-8">
                  
                  {/* Message Input */}
                  <div className="space-y-3">
                    <Label className="text-zinc-300 font-semibold">Custom Message</Label>
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

                  {/* Quick Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <Label className="text-zinc-300">Brightness</Label>
                        <span className="text-zinc-500 text-sm">{settings.brightness}%</span>
                      </div>
                      <Slider 
                        value={[settings.brightness]} 
                        min={0} max={100} 
                        onValueChange={(v) => sendSettings({...settings, brightness: v[0]})}
                        className="[&_[role=slider]]:bg-orange-500"
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <Label className="text-zinc-300">Scroll Speed</Label>
                        <span className="text-zinc-500 text-sm">{settings.speed}</span>
                      </div>
                      <Slider 
                        value={[settings.speed]} 
                        min={0} max={100} 
                        onValueChange={(v) => sendSettings({...settings, speed: v[0]})}
                        className="[&_[role=slider]]:bg-orange-500"
                      />
                    </div>
                    <div className="space-y-4">
                      <Label className="text-zinc-300">Color</Label>
                      <div className="flex gap-3">
                        <Input 
                          type="color" 
                          value={settings.color} 
                          onChange={(e) => sendSettings({...settings, color: e.target.value})} 
                          className="h-10 w-20 p-1 bg-zinc-900 border-zinc-800 cursor-pointer" 
                        />
                        <Select value={settings.mode} onValueChange={(v) => sendSettings({...settings, mode: v})}>
                          <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scroll">Scroll Left</SelectItem>
                            <SelectItem value="static">Static</SelectItem>
                            <SelectItem value="flash">Flash</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="display" className="mt-6">
              <DisplaySettings settings={settings} onSave={sendSettings} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - System & Feeds */}
        <div className="xl:col-span-4 space-y-6">
          
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

          {/* Network & System */}
          <Card className="bg-zinc-950 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-zinc-100 flex items-center gap-2 text-lg">
                <Settings2 className="w-4 h-4 text-orange-500" />
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
                  <Badge variant="outline" className="bg-zinc-900 text-zinc-400 border-zinc-800">{systemStatus.network}</Badge>
                </div>
                <div className="flex gap-2">
                  <Select onValueChange={setSelectedWifi}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 flex-1">
                      <SelectValue placeholder="Select Network" />
                    </SelectTrigger>
                    <SelectContent>
                      {wifiNetworks.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
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
                <div className="flex gap-2">
                  <Select onValueChange={setSelectedBluetooth}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 flex-1">
                      <SelectValue placeholder="Select Device" />
                    </SelectTrigger>
                    <SelectContent>
                      {bluetoothDevices.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
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

          {/* RSS Feeds */}
          <Card className="bg-zinc-950 border-zinc-800 flex flex-col h-[400px]">
            <CardHeader className="pb-3 shrink-0">
              <CardTitle className="text-zinc-100 flex items-center gap-2 text-lg">
                <Rss className="w-4 h-4 text-orange-500" />
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
    </div>
  );
}
