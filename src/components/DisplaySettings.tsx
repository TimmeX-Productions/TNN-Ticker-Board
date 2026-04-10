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
      <Card className="bg-[#001f3d] border-[#1d3557] rounded-none border-t-4 border-t-[#e63946]">
        <CardHeader>
          <CardTitle className="text-white font-black uppercase italic tracking-tighter">Hardware Configuration</CardTitle>
          <CardDescription className="text-[#a8dadc]/60 font-bold uppercase text-[10px] tracking-widest">Physical panel layout and mapping.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">Rows</Label>
              <Input type="number" className="bg-[#001224] border-[#1d3557] text-white rounded-none font-mono" value={localSettings.hardware?.rows || 32} onChange={(e) => updateHardware('rows', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">Cols</Label>
              <Input type="number" className="bg-[#001224] border-[#1d3557] text-white rounded-none font-mono" value={localSettings.hardware?.cols || 64} onChange={(e) => updateHardware('cols', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">Chain Length</Label>
              <Input type="number" className="bg-[#001224] border-[#1d3557] text-white rounded-none font-mono" value={localSettings.hardware?.chain_length || 2} onChange={(e) => updateHardware('chain_length', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">Parallel</Label>
              <Input type="number" className="bg-[#001224] border-[#1d3557] text-white rounded-none font-mono" value={localSettings.hardware?.parallel || 1} onChange={(e) => updateHardware('parallel', parseInt(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">Hardware Mapping</Label>
              <Select value={localSettings.hardware?.hardware_mapping || 'adafruit-hat-pwm'} onValueChange={(v) => updateHardware('hardware_mapping', v)}>
                <SelectTrigger className="bg-[#001224] border-[#1d3557] text-white rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#001f3d] border-[#1d3557] text-white">
                  <SelectItem value="adafruit-hat-pwm">Adafruit HAT (PWM)</SelectItem>
                  <SelectItem value="adafruit-hat">Adafruit HAT (No PWM)</SelectItem>
                  <SelectItem value="regular">Regular GPIO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">GPIO Slowdown</Label>
              <Input type="number" className="bg-[#001224] border-[#1d3557] text-white rounded-none font-mono" value={localSettings.runtime?.gpio_slowdown || 4} onChange={(e) => updateRuntime('gpio_slowdown', parseInt(e.target.value))} />
              <p className="text-[10px] text-[#a8dadc]/50 uppercase font-bold">Pi 3: 3, Pi 4: 4, Pi 5: 5</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#001f3d] border-[#1d3557] rounded-none border-t-4 border-t-[#e63946]">
        <CardHeader>
          <CardTitle className="text-white font-black uppercase italic tracking-tighter">Advanced Timing & PWM</CardTitle>
          <CardDescription className="text-[#a8dadc]/60 font-bold uppercase text-[10px] tracking-widest">Fine-tune color depth and refresh rates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">PWM Bits</Label>
              <Input type="number" className="bg-[#001224] border-[#1d3557] text-white rounded-none font-mono" value={localSettings.hardware?.pwm_bits || 9} onChange={(e) => updateHardware('pwm_bits', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">PWM Dither Bits</Label>
              <Input type="number" className="bg-[#001224] border-[#1d3557] text-white rounded-none font-mono" value={localSettings.hardware?.pwm_dither_bits || 1} onChange={(e) => updateHardware('pwm_dither_bits', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">LSB Nanoseconds</Label>
              <Input type="number" className="bg-[#001224] border-[#1d3557] text-white rounded-none font-mono" value={localSettings.hardware?.pwm_lsb_nanoseconds || 130} onChange={(e) => updateHardware('pwm_lsb_nanoseconds', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">Max Refresh (Hz)</Label>
              <Input type="number" className="bg-[#001224] border-[#1d3557] text-white rounded-none font-mono" value={localSettings.hardware?.limit_refresh_rate_hz || 100} onChange={(e) => updateHardware('limit_refresh_rate_hz', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-[#a8dadc]">Scan Mode</Label>
              <Input type="number" className="bg-[#001224] border-[#1d3557] text-white rounded-none font-mono" value={localSettings.hardware?.scan_mode || 0} onChange={(e) => updateHardware('scan_mode', parseInt(e.target.value))} />
            </div>
          </div>

          <Separator className="bg-[#1d3557] my-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border border-[#1d3557] rounded-none bg-[#001224]/50">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold uppercase text-[#a8dadc]">Inverse Colors</Label>
                <p className="text-[10px] text-[#a8dadc]/50 uppercase">Invert all colors</p>
              </div>
              <Switch checked={localSettings.hardware?.inverse_colors || false} onCheckedChange={(c) => updateHardware('inverse_colors', c)} className="data-[state=checked]:bg-[#e63946]" />
            </div>
            <div className="flex items-center justify-between p-3 border border-[#1d3557] rounded-none bg-[#001224]/50">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold uppercase text-[#a8dadc]">Show Refresh Rate</Label>
                <p className="text-[10px] text-[#a8dadc]/50 uppercase">Display FPS on matrix</p>
              </div>
              <Switch checked={localSettings.hardware?.show_refresh_rate || false} onCheckedChange={(c) => updateHardware('show_refresh_rate', c)} className="data-[state=checked]:bg-[#e63946]" />
            </div>
            <div className="flex items-center justify-between p-3 border border-[#1d3557] rounded-none bg-[#001224]/50">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold uppercase text-[#a8dadc]">Disable Hardware Pulsing</Label>
                <p className="text-[10px] text-[#a8dadc]/50 uppercase">Only if timing issues occur</p>
              </div>
              <Switch checked={localSettings.hardware?.disable_hardware_pulsing || false} onCheckedChange={(c) => updateHardware('disable_hardware_pulsing', c)} className="data-[state=checked]:bg-[#e63946]" />
            </div>
            <div className="flex items-center justify-between p-3 border border-[#1d3557] rounded-none bg-[#001224]/50">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold uppercase text-[#a8dadc]">Short Date Format</Label>
                <p className="text-[10px] text-[#a8dadc]/50 uppercase">Use "Jan 15" instead of "January 15th"</p>
              </div>
              <Switch checked={localSettings.use_short_date_format || false} onCheckedChange={(c) => setLocalSettings({...localSettings, use_short_date_format: c})} className="data-[state=checked]:bg-[#e63946]" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => onSave(localSettings)} className="bg-[#e63946] hover:bg-[#c1121f] text-white px-8 rounded-none font-black uppercase italic tracking-tighter">
          Apply Configuration
        </Button>
      </div>
    </div>
  );
}
