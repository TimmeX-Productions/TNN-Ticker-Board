/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast, Toaster } from 'sonner';

const socket = io(); 

export default function App() {
  const [message, setMessage] = useState('');
  const [news, setNews] = useState<{ title: string; image: string } | null>(null);
  const [feeds, setFeeds] = useState<string[]>([]);
  const [newFeed, setNewFeed] = useState('');
  const [status, setStatus] = useState('Disconnected');
  const [systemStatus, setSystemStatus] = useState({ network: 'Unknown', bluetooth: 'Unknown' });
  const [settings, setSettings] = useState({ brightness: 100, color: '#ffffff', speed: 50, mode: 'scroll' });

  const [presets, setPresets] = useState<string[]>([]);
  const [presetName, setPresetName] = useState('');
  const [health, setHealth] = useState({ cpu: 0, temp: 0 });
  const [wifiNetworks, setWifiNetworks] = useState<string[]>([]);
  const [bluetoothDevices, setBluetoothDevices] = useState<string[]>([]);
  const [selectedWifi, setSelectedWifi] = useState('');
  const [selectedBluetooth, setSelectedBluetooth] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');

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
      socket.off('status-update');
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
    if (message.trim()) { socket.emit('send-message', message); setMessage(''); }
  };

  const clearMatrix = () => {
    socket.emit('send-message', '');
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8 dark">
      <Toaster />
      <h1 className="text-4xl font-bold mb-8 text-primary">LED Matrix Control</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {news && (
            <Card>
              <CardHeader><CardTitle>Latest News</CardTitle></CardHeader>
              <CardContent>
                <p className="text-lg font-medium">{news.title}</p>
                {news.image && <img src={news.image} alt="News" className="mt-4 h-32 rounded" />}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>RSS Feeds</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={addFeed} className="flex gap-2 mb-4">
                <Input type="url" value={newFeed} onChange={(e) => setNewFeed(e.target.value)} placeholder="Add RSS URL" />
                <Button type="submit">Add</Button>
              </form>
              <ul className="space-y-2">
                {feeds.map((f, index) => <li key={`${f}-${index}`} className="flex justify-between bg-muted p-2 rounded">{f} <Button variant="ghost" size="sm" onClick={() => socket.emit('remove-feed', f)} className="text-destructive">X</Button></li>)}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>System Management</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Network: {systemStatus.network}</span>
                  <Button size="sm" variant="outline" onClick={() => socket.emit('scan-wifi')}>Scan Wi-Fi</Button>
                </div>
                <Select onValueChange={setSelectedWifi}>
                  <SelectTrigger><SelectValue placeholder="Select Wi-Fi" /></SelectTrigger>
                  <SelectContent>
                    {wifiNetworks.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="password" placeholder="Password" value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} />
                <Button size="sm" className="w-full" onClick={() => socket.emit('connect-wifi', { ssid: selectedWifi, password: wifiPassword })}>Connect</Button>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Bluetooth: {systemStatus.bluetooth}</span>
                  <Button size="sm" variant="outline" onClick={() => socket.emit('scan-bluetooth')}>Scan BT</Button>
                </div>
                <Select onValueChange={setSelectedBluetooth}>
                  <SelectTrigger><SelectValue placeholder="Select Device" /></SelectTrigger>
                  <SelectContent>
                    {bluetoothDevices.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" className="w-full" onClick={() => socket.emit('pair-bluetooth', { device: selectedBluetooth })}>Pair</Button>
              </div>

              <div className="flex justify-between items-center text-sm pt-4 border-t">
                <span>CPU: {health.cpu}%</span>
                <span>Temp: {health.temp}°C</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={() => socket.emit('reboot-pi')}>Reboot</Button>
                <Button size="sm" variant="destructive" onClick={() => socket.emit('shutdown-pi')}>Shutdown</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Presets</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Preset name" />
                <Button size="sm" onClick={() => socket.emit('save-preset', { name: presetName, settings })}>Save</Button>
              </div>
              <Select onValueChange={(v) => socket.emit('load-preset', v)}>
                <SelectTrigger><SelectValue placeholder="Load Preset" /></SelectTrigger>
                <SelectContent>
                  {presets.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Live Controls</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Label>Brightness ({settings.brightness}%)</Label>
              <Slider value={[settings.brightness]} min={0} max={100} onValueChange={(v) => sendSettings({...settings, brightness: v[0]})} />
              <Label>Color</Label>
              <Input type="color" value={settings.color} onChange={(e) => sendSettings({...settings, color: e.target.value})} className="h-10" />
              <Label>Mode</Label>
              <Select value={settings.mode} onValueChange={(v) => sendSettings({...settings, mode: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scroll">Scroll Left</SelectItem>
                  <SelectItem value="static">Static</SelectItem>
                  <SelectItem value="flash">Flash</SelectItem>
                </SelectContent>
              </Select>
              <form onSubmit={sendMessage} className="flex gap-2 mt-4">
                <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message" />
                <Button type="submit">Send</Button>
                <Button variant="destructive" onClick={() => socket.emit('send-message', '')}>Clear</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
