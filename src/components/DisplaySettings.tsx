import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function DisplaySettings({ settings, onSave }: { settings: any, onSave: (s: any) => void }) {
  const [localSettings, setLocalSettings] = useState(settings);

  return (
    <Card>
      <CardHeader><CardTitle>Display Settings</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Rows</Label>
            <Input type="number" value={localSettings.hardware.rows} onChange={(e) => setLocalSettings({...localSettings, hardware: {...localSettings.hardware, rows: parseInt(e.target.value)}})} />
          </div>
          <div className="space-y-1">
            <Label>Cols</Label>
            <Input type="number" value={localSettings.hardware.cols} onChange={(e) => setLocalSettings({...localSettings, hardware: {...localSettings.hardware, cols: parseInt(e.target.value)}})} />
          </div>
          <div className="space-y-1">
            <Label>Chain Length</Label>
            <Input type="number" value={localSettings.hardware.chain_length} onChange={(e) => setLocalSettings({...localSettings, hardware: {...localSettings.hardware, chain_length: parseInt(e.target.value)}})} />
          </div>
          <div className="space-y-1">
            <Label>Parallel</Label>
            <Input type="number" value={localSettings.hardware.parallel} onChange={(e) => setLocalSettings({...localSettings, hardware: {...localSettings.hardware, parallel: parseInt(e.target.value)}})} />
          </div>
          <div className="space-y-1">
            <Label>Brightness</Label>
            <Input type="number" value={localSettings.hardware.brightness} onChange={(e) => setLocalSettings({...localSettings, hardware: {...localSettings.hardware, brightness: parseInt(e.target.value)}})} />
          </div>
          <div className="space-y-1">
            <Label>GPIO Slowdown</Label>
            <Input type="number" value={localSettings.runtime.gpio_slowdown} onChange={(e) => setLocalSettings({...localSettings, runtime: {...localSettings.runtime, gpio_slowdown: parseInt(e.target.value)}})} />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Switch checked={localSettings.use_short_date_format} onCheckedChange={(checked) => setLocalSettings({...localSettings, use_short_date_format: checked})} />
          <Label>Use Short Date Format</Label>
        </div>
        <Button onClick={() => onSave(localSettings)}>Save Settings</Button>
      </CardContent>
    </Card>
  );
}
