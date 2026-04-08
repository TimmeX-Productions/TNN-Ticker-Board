import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect } from 'react';

export default function DisplaySettings({ settings, onSave }: { settings: any, onSave: (s: any) => void }) {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateHardware = (key: string, value: any) => {
    setLocalSettings({ ...localSettings, hardware: { ...localSettings.hardware, [key]: value } });
  };

  const updateRuntime = (key: string, value: any) => {
    setLocalSettings({ ...localSettings, runtime: { ...localSettings.runtime, [key]: value } });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Hardware Configuration</CardTitle>
          <CardDescription className="text-zinc-400">Physical panel layout and mapping.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Rows</Label>
              <Input type="number" className="bg-zinc-900 border-zinc-800 text-zinc-100" value={localSettings.hardware?.rows || 32} onChange={(e) => updateHardware('rows', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Cols</Label>
              <Input type="number" className="bg-zinc-900 border-zinc-800 text-zinc-100" value={localSettings.hardware?.cols || 64} onChange={(e) => updateHardware('cols', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Chain Length</Label>
              <Input type="number" className="bg-zinc-900 border-zinc-800 text-zinc-100" value={localSettings.hardware?.chain_length || 2} onChange={(e) => updateHardware('chain_length', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Parallel</Label>
              <Input type="number" className="bg-zinc-900 border-zinc-800 text-zinc-100" value={localSettings.hardware?.parallel || 1} onChange={(e) => updateHardware('parallel', parseInt(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Hardware Mapping</Label>
              <Select value={localSettings.hardware?.hardware_mapping || 'adafruit-hat-pwm'} onValueChange={(v) => updateHardware('hardware_mapping', v)}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adafruit-hat-pwm">Adafruit HAT (PWM)</SelectItem>
                  <SelectItem value="adafruit-hat">Adafruit HAT (No PWM)</SelectItem>
                  <SelectItem value="regular">Regular GPIO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">GPIO Slowdown</Label>
              <Input type="number" className="bg-zinc-900 border-zinc-800 text-zinc-100" value={localSettings.runtime?.gpio_slowdown || 4} onChange={(e) => updateRuntime('gpio_slowdown', parseInt(e.target.value))} />
              <p className="text-xs text-zinc-500">Pi 3: 3, Pi 4: 4, Pi 5: 5</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Advanced Timing & PWM</CardTitle>
          <CardDescription className="text-zinc-400">Fine-tune color depth and refresh rates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">PWM Bits</Label>
              <Input type="number" className="bg-zinc-900 border-zinc-800 text-zinc-100" value={localSettings.hardware?.pwm_bits || 9} onChange={(e) => updateHardware('pwm_bits', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">PWM Dither Bits</Label>
              <Input type="number" className="bg-zinc-900 border-zinc-800 text-zinc-100" value={localSettings.hardware?.pwm_dither_bits || 1} onChange={(e) => updateHardware('pwm_dither_bits', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">LSB Nanoseconds</Label>
              <Input type="number" className="bg-zinc-900 border-zinc-800 text-zinc-100" value={localSettings.hardware?.pwm_lsb_nanoseconds || 130} onChange={(e) => updateHardware('pwm_lsb_nanoseconds', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Max Refresh (Hz)</Label>
              <Input type="number" className="bg-zinc-900 border-zinc-800 text-zinc-100" value={localSettings.hardware?.limit_refresh_rate_hz || 100} onChange={(e) => updateHardware('limit_refresh_rate_hz', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Scan Mode</Label>
              <Input type="number" className="bg-zinc-900 border-zinc-800 text-zinc-100" value={localSettings.hardware?.scan_mode || 0} onChange={(e) => updateHardware('scan_mode', parseInt(e.target.value))} />
            </div>
          </div>

          <Separator className="bg-zinc-800 my-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border border-zinc-800 rounded-md bg-zinc-900/50">
              <div className="space-y-0.5">
                <Label className="text-zinc-300">Inverse Colors</Label>
                <p className="text-xs text-zinc-500">Invert all colors</p>
              </div>
              <Switch checked={localSettings.hardware?.inverse_colors || false} onCheckedChange={(c) => updateHardware('inverse_colors', c)} />
            </div>
            <div className="flex items-center justify-between p-3 border border-zinc-800 rounded-md bg-zinc-900/50">
              <div className="space-y-0.5">
                <Label className="text-zinc-300">Show Refresh Rate</Label>
                <p className="text-xs text-zinc-500">Display FPS on matrix</p>
              </div>
              <Switch checked={localSettings.hardware?.show_refresh_rate || false} onCheckedChange={(c) => updateHardware('show_refresh_rate', c)} />
            </div>
            <div className="flex items-center justify-between p-3 border border-zinc-800 rounded-md bg-zinc-900/50">
              <div className="space-y-0.5">
                <Label className="text-zinc-300">Disable Hardware Pulsing</Label>
                <p className="text-xs text-zinc-500">Only if timing issues occur</p>
              </div>
              <Switch checked={localSettings.hardware?.disable_hardware_pulsing || false} onCheckedChange={(c) => updateHardware('disable_hardware_pulsing', c)} />
            </div>
            <div className="flex items-center justify-between p-3 border border-zinc-800 rounded-md bg-zinc-900/50">
              <div className="space-y-0.5">
                <Label className="text-zinc-300">Short Date Format</Label>
                <p className="text-xs text-zinc-500">Use "Jan 15" instead of "January 15th"</p>
              </div>
              <Switch checked={localSettings.use_short_date_format || false} onCheckedChange={(c) => setLocalSettings({...localSettings, use_short_date_format: c})} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => onSave(localSettings)} className="bg-orange-600 hover:bg-orange-700 text-white px-8">
          Apply Settings
        </Button>
      </div>
    </div>
  );
}
