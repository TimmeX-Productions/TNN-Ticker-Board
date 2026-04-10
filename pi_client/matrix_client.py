import socketio
import psutil
import subprocess
import time
import threading
import json
import os
import socket
import urllib.request
import traceback
from io import BytesIO
from PIL import Image

try:
    from rgbmatrix import RGBMatrix, RGBMatrixOptions, graphics
    HAS_MATRIX = True
    MATRIX_ERROR = ""
except ImportError as e:
    HAS_MATRIX = False
    MATRIX_ERROR = str(e)

# --- Configuration ---
SERVER_URL = 'http://127.0.0.1:3000' 
# ---------------------

sio = socketio.Client()

# Global state
current_message = ""
current_news = None
matrix = None
canvas = None
current_image = None
last_image_url = ""
font_loaded = False
font = None

settings = {
    "hardware": {
        "rows": 32, "cols": 64, "chain_length": 2, "parallel": 1,
        "brightness": 90, "hardware_mapping": "adafruit-hat-pwm",
        "scan_mode": 0, "pwm_bits": 9, "pwm_dither_bits": 1,
        "pwm_lsb_nanoseconds": 130, "disable_hardware_pulsing": False,
        "inverse_colors": False, "show_refresh_rate": False,
        "limit_refresh_rate_hz": 100
    },
    "runtime": {"gpio_slowdown": 4},
    "brightness": 100,
    "color": "#ffffff",
    "speed": 50,
    "mode": "scroll",
    "font": "7x13.bdf",
    "image_url": ""
}

def hex_to_rgb(hex_color):
    try:
        hex_color = str(hex_color).lstrip('#')
        if len(hex_color) != 6:
            return (255, 255, 255)
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    except:
        return (255, 255, 255)

def init_matrix():
    global matrix, canvas
    if not HAS_MATRIX:
        return
    try:
        options = RGBMatrixOptions()
        hw = settings.get("hardware", {})
        rt = settings.get("runtime", {})
        
        options.rows = hw.get("rows", 32)
        options.cols = hw.get("cols", 64)
        options.chain_length = hw.get("chain_length", 2)
        options.parallel = hw.get("parallel", 1)
        options.hardware_mapping = hw.get("hardware_mapping", "adafruit-hat-pwm")
        options.gpio_slowdown = rt.get("gpio_slowdown", 4)
        options.brightness = int(settings.get("brightness", 100))
        options.pwm_bits = hw.get("pwm_bits", 9)
        options.pwm_dither_bits = hw.get("pwm_dither_bits", 1)
        options.pwm_lsb_nanoseconds = hw.get("pwm_lsb_nanoseconds", 130)
        options.scan_mode = hw.get("scan_mode", 0)
        options.disable_hardware_pulsing = hw.get("disable_hardware_pulsing", False)
        options.inverse_colors = hw.get("inverse_colors", False)
        options.show_refresh_rate = hw.get("show_refresh_rate", False)
        options.limit_refresh_rate_hz = hw.get("limit_refresh_rate_hz", 100)
        options.drop_privileges = False

        matrix = RGBMatrix(options=options)
        canvas = matrix.CreateFrameCanvas()
    except Exception as e:
        print(f"Matrix init failed: {e}")
        if sio.connected:
            sio.emit("client-error", f"Matrix Init Failed: {e}")

def load_image(url):
    global current_image, last_image_url
    if url == last_image_url:
        return
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            img_data = response.read()
            img = Image.open(BytesIO(img_data)).convert('RGB')
            if HAS_MATRIX and matrix:
                img.thumbnail((matrix.width, matrix.height), Image.Resampling.LANCZOS)
            current_image = img
            last_image_url = url
    except Exception as e:
        print(f"Failed to load image: {e}")
        current_image = None
        last_image_url = ""

import re

inline_image_cache = {}

def get_inline_image(url, target_height):
    if url in inline_image_cache:
        return inline_image_cache[url]
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=3) as response:
            img = Image.open(response)
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                bg = Image.new('RGB', img.size, (0, 0, 0))
                bg.paste(img, mask=img.convert('RGBA').split()[3])
                img = bg
            else:
                img = img.convert('RGB')
            
            aspect = img.width / img.height
            target_width = int(target_height * aspect)
            if target_width < 1: target_width = 1
            img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
            inline_image_cache[url] = img
            return img
    except Exception as e:
        print(f"Error loading inline image {url}: {e}")
        inline_image_cache[url] = None
        return None

def get_colored_text_width(font, text):
    clean_text = re.sub(r'\{[rgbcwd]\}', '', text)
    img_tags = re.findall(r'\{img:(.*?)\}', clean_text)
    clean_text = re.sub(r'\{img:.*?\}', '', clean_text)
    
    width = 0
    if hasattr(font, 'CharacterWidth'):
        width = sum([font.CharacterWidth(ord(c)) for c in clean_text])
    else:
        width = len(clean_text) * 7
        
    font_height = font.height if hasattr(font, 'height') else 13
    width += len(img_tags) * (font_height + 2)
    
    return width

def draw_colored_text(canvas, font, x, y, default_color, text):
    parts = re.split(r'(\{.*?\})', text)
    current_color = default_color
    current_x = x
    
    colors = {
        '{r}': graphics.Color(255, 0, 0),
        '{g}': graphics.Color(0, 255, 0),
        '{b}': graphics.Color(0, 100, 255),
        '{y}': graphics.Color(255, 255, 0),
        '{w}': graphics.Color(255, 255, 255),
        '{c}': graphics.Color(0, 255, 255),
        '{d}': default_color
    }
    
    font_height = font.height if hasattr(font, 'height') else 13
    
    for part in parts:
        if part in colors:
            current_color = colors[part]
        elif part.startswith('{img:') and part.endswith('}'):
            url = part[5:-1]
            img = get_inline_image(url, font_height)
            if img:
                img_y = y - font_height + 2
                if img_y < 0: img_y = 0
                canvas.SetImage(img, current_x, img_y)
                current_x += img.width + 2
        elif part:
            len_drawn = graphics.DrawText(canvas, font, current_x, y, current_color, part)
            current_x += len_drawn
            
    return current_x - x

def draw_loop():
    global canvas, current_message, current_news, current_image, font_loaded, font
    
    if not HAS_MATRIX:
        print("Running in MOCK mode. Draw loop disabled.")
        while True:
            time.sleep(1)
            
    font = graphics.Font()
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    font_path = os.path.join(base_dir, "fonts", settings.get('font', '7x13.bdf'))
    
    if not os.path.exists(font_path):
        font_path = os.path.join(base_dir, "fonts", "7x13.bdf")
        
    try:
        font.LoadFont(font_path)
        font_loaded = True
    except Exception as e:
        print(f"Failed to load font {font_path}: {e}")
        font_loaded = False
    
    if not canvas:
        print("Canvas not initialized. Exiting draw loop.")
        return

    pos = canvas.width
    bounce_dir = -1
    
    while True:
        try:
            canvas.Clear()
            
            image_url = settings.get("image_url", "")
            if image_url:
                load_image(image_url)
                if current_image:
                    x = (canvas.width - current_image.width) // 2
                    y = (canvas.height - current_image.height) // 2
                    canvas.SetImage(current_image, x, y)
            
            color_rgb = hex_to_rgb(settings.get("color", "#ffffff"))
            text_color = graphics.Color(color_rgb[0], color_rgb[1], color_rgb[2])
            
            display_text = current_message
            if not display_text and current_news and not image_url:
                display_text = f"NEWS: {current_news.get('title', '')}"
                
            if not display_text and not image_url:
                display_text = "Waiting for messages..."

            if display_text and font_loaded:
                effect = settings.get("effect", "scroll")
                text_width = get_colored_text_width(font, display_text)
                
                y_offset = int(settings.get("font_y_offset", 0))
                y_pos = (canvas.height // 2) + 4 + y_offset
                
                if effect == "static":
                    draw_colored_text(canvas, font, (canvas.width - text_width) // 2, y_pos, text_color, display_text)
                elif effect == "bounce":
                    draw_colored_text(canvas, font, pos, y_pos, text_color, display_text)
                    pos += bounce_dir
                    if pos < 0 or pos + text_width > canvas.width:
                        bounce_dir *= -1
                elif effect == "flash":
                    if int(time.time() * 2) % 2 == 0:
                        draw_colored_text(canvas, font, (canvas.width - text_width) // 2, y_pos, text_color, display_text)
                elif effect == "typewriter":
                    # Reveal characters based on time
                    reveal_speed = settings.get("speed", 50) / 100.0 * 5.0 # chars per second
                    chars_to_show = int((time.time() % (len(display_text) / reveal_speed + 2)) * reveal_speed)
                    if chars_to_show > len(display_text): chars_to_show = len(display_text)
                    partial_text = display_text[:chars_to_show]
                    partial_width = get_colored_text_width(font, partial_text)
                    draw_colored_text(canvas, font, (canvas.width - partial_width) // 2, y_pos, text_color, partial_text)
                else: # scroll
                    draw_colored_text(canvas, font, pos, y_pos, text_color, display_text)
                    pos -= 1
                    if (pos + text_width < 0):
                        pos = canvas.width

            # Handle brightness schedule
            schedule = settings.get("schedule", {})
            if schedule.get("enabled", False):
                now = time.localtime()
                current_time = f"{now.tm_hour:02d}:{now.tm_min:02d}"
                start = schedule.get("night_start", "22:00")
                end = schedule.get("night_end", "07:00")
                
                is_night = False
                if start < end:
                    is_night = start <= current_time < end
                else: # crosses midnight
                    is_night = current_time >= start or current_time < end
                    
                target_brightness = int(schedule.get("night_brightness", 20)) if is_night else int(schedule.get("day_brightness", 100))
                matrix.brightness = target_brightness
            else:
                matrix.brightness = int(settings.get("brightness", 100))

            canvas = matrix.SwapOnVSync(canvas)
            
            speed = settings.get("speed", 50)
            delay = max(0.01, (100 - speed) * 0.001)
            time.sleep(delay)
            
        except Exception as e:
            print(f"Draw loop error: {e}")
            time.sleep(1)

def get_system_status():
    network = "Disconnected"
    ip_address = "Unknown"
    
    try:
        addrs = psutil.net_if_addrs()
        
        # Prioritize common interfaces
        priority_ifaces = ['wlan0', 'eth0', 'bnep0', 'pan0', 'en0']
        
        # First pass: check priority interfaces
        for iface in priority_ifaces:
            if iface in addrs:
                for addr in addrs[iface]:
                    if addr.family == socket.AF_INET and not addr.address.startswith("127."):
                        ip_address = addr.address
                        network = f"Connected ({iface})"
                        break
            if ip_address != "Unknown":
                break
                
        # Second pass: check any other interface if not found
        if ip_address == "Unknown":
            for iface, addr_list in addrs.items():
                if iface == 'lo' or iface.startswith('docker') or iface.startswith('veth'): continue
                for addr in addr_list:
                    if addr.family == socket.AF_INET and not addr.address.startswith("127."):
                        ip_address = addr.address
                        network = f"Connected ({iface})"
                        break
                if ip_address != "Unknown":
                    break
    except Exception as e:
        print(f"IP detection error: {e}")
        pass

    bluetooth = "Unknown"
    try:
        bt_status = subprocess.check_output(["rfkill", "list", "bluetooth"]).decode()
        bluetooth = "On" if "Soft blocked: no" in bt_status else "Off"
    except:
        pass
        
    return {"network": network, "ip_address": ip_address, "bluetooth": bluetooth}

def background_tasks():
    while True:
        if sio.connected:
            try:
                if not HAS_MATRIX:
                    sio.emit("client-error", f"Matrix Library Missing: {MATRIX_ERROR}. Did Adafruit script fail?")
                elif not canvas:
                    sio.emit("client-error", "Matrix Canvas failed to initialize. Check hardware mapping/sudo.")
                elif not font_loaded:
                    sio.emit("client-error", "Font failed to load. Check fonts folder.")

                sio.emit("system-status", get_system_status())
                
                cpu = psutil.cpu_percent()
                temp = 0
                try:
                    temp_str = subprocess.check_output(["vcgencmd", "measure_temp"]).decode()
                    temp = float(temp_str.replace("temp=", "").replace("'C\n", ""))
                except:
                    try:
                        with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                            temp = float(f.read()) / 1000.0
                    except:
                        pass
                sio.emit("health-update", {"cpu": cpu, "temp": temp})
            except Exception as e:
                print(f"Background task error: {e}")
        time.sleep(3)

@sio.event
def connect():
    print("Connected to server!")
    sio.emit("system-status", get_system_status())

@sio.on('display-message')
def on_display_message(msg):
    global current_message
    current_message = msg
    print("New message:", msg)

@sio.on('news-update')
def on_news_update(news):
    global current_news
    current_news = news

@sio.on('request-scan-wifi')
def on_scan_wifi():
    networks = []
    try:
        try:
            subprocess.run(["nmcli", "dev", "wifi", "rescan"], timeout=5)
        except:
            pass
        results = subprocess.check_output(["nmcli", "-t", "-f", "SSID", "dev", "wifi"]).decode().split('\n')
        networks = list(set([r.strip() for r in results if r.strip()]))
    except Exception as e:
        print("nmcli failed, trying iwlist...", e)
        try:
            scan_out = subprocess.check_output(["sudo", "iwlist", "wlan0", "scan"]).decode()
            for line in scan_out.split('\n'):
                if "ESSID:" in line:
                    ssid = line.split('ESSID:"')[1].split('"')[0]
                    if ssid:
                        networks.append(ssid)
            networks = list(set(networks))
        except Exception as e2:
            print("iwlist failed:", e2)
            sio.emit("client-error", f"WiFi Scan Error: {e2}")
            
    sio.emit("wifi-scan-results", networks)

@sio.on('request-scan-bluetooth')
def on_scan_bluetooth():
    devices = []
    try:
        # Try using timeout with bluetoothctl (works on newer bluez)
        try:
            subprocess.run(["sudo", "bluetoothctl", "--timeout", "5", "scan", "on"], capture_output=True)
        except:
            # Fallback to manual sleep
            p = subprocess.Popen(["sudo", "bluetoothctl", "scan", "on"])
            time.sleep(5)
            subprocess.Popen(["sudo", "bluetoothctl", "scan", "off"]).wait()
            
        results = subprocess.check_output(["sudo", "bluetoothctl", "devices"]).decode().split('\n')
        for r in results:
            if r.startswith("Device"):
                parts = r.split(' ', 2)
                if len(parts) >= 3:
                    name = parts[2].strip()
                    if name and name != parts[1]: # Avoid just showing MAC addresses if possible
                        devices.append(name)
        devices = list(set(devices))
    except Exception as e:
        print("bluetoothctl failed, trying hcitool...", e)
        try:
            scan_out = subprocess.check_output(["sudo", "hcitool", "scan"]).decode().split('\n')
            for line in scan_out:
                parts = line.split('\t')
                if len(parts) >= 3:
                    name = parts[2].strip()
                    if name:
                        devices.append(name)
            devices = list(set(devices))
        except Exception as e2:
            print("hcitool failed:", e2)
            sio.emit("client-error", f"BT Scan Error: {e2}")
            
    sio.emit("bluetooth-scan-results", devices)

@sio.on('request-connect-wifi')
def on_connect_wifi(data):
    try:
        subprocess.run(["sudo", "nmcli", "dev", "wifi", "connect", data['ssid'], "password", data['password']], check=True)
        sio.emit("connection-status", {"type": "wifi", "status": "success", "message": f"Connected to {data['ssid']}"})
        sio.emit("system-status", get_system_status())
    except Exception as e:
        sio.emit("connection-status", {"type": "wifi", "status": "error", "message": f"Failed: {str(e)}"})

@sio.on('request-pair-bluetooth')
def on_pair_bluetooth(data):
    try:
        results = subprocess.check_output(["sudo", "bluetoothctl", "devices"]).decode().split('\n')
        mac = None
        for r in results:
            if data['device'] in r:
                parts = r.split(' ')
                if len(parts) > 1:
                    mac = parts[1]
                break
        if mac:
            sio.emit("pi-log", {"level": "info", "message": f"Attempting to pair with MAC: {mac}"})
            
            # Remove device first in case it's in a bad state
            subprocess.run(["sudo", "bluetoothctl", "remove", mac], capture_output=True)
            
            pair_res = subprocess.run(["sudo", "bluetoothctl", "pair", mac], capture_output=True, text=True)
            if pair_res.returncode != 0:
                sio.emit("pi-log", {"level": "error", "message": f"Pair failed: {pair_res.stderr} {pair_res.stdout}"})
                
            trust_res = subprocess.run(["sudo", "bluetoothctl", "trust", mac], capture_output=True, text=True)
            if trust_res.returncode != 0:
                sio.emit("pi-log", {"level": "error", "message": f"Trust failed: {trust_res.stderr} {trust_res.stdout}"})
                
            sio.emit("connection-status", {"type": "bluetooth", "status": "success", "message": f"Paired with {data['device']}"})
        else:
            sio.emit("pi-log", {"level": "error", "message": f"Device MAC not found for {data['device']}"})
            sio.emit("connection-status", {"type": "bluetooth", "status": "error", "message": "Device MAC not found"})
    except Exception as e:
        sio.emit("pi-log", {"level": "error", "message": f"Bluetooth pair exception: {str(e)}"})
        sio.emit("connection-status", {"type": "bluetooth", "status": "error", "message": f"Failed: {str(e)}"})

@sio.on('request-enable-bt-pan')
def on_enable_bt_pan():
    try:
        sio.emit("pi-log", {"level": "info", "message": "Starting Bluetooth PAN setup..."})
        # Ensure Bluetooth is powered on and agent is running
        subprocess.run(["sudo", "bluetoothctl", "power", "on"], capture_output=True)
        # Use NoInputNoOutput to allow modern phones (like Pixel) to pair without a PIN code
        subprocess.run(["sudo", "bluetoothctl", "agent", "NoInputNoOutput"], capture_output=True)
        subprocess.run(["sudo", "bluetoothctl", "default-agent"], capture_output=True)
        
        # Set Bluetooth name and make discoverable indefinitely
        subprocess.run(["sudo", "bluetoothctl", "system-alias", "LEDPI"], capture_output=True)
        subprocess.run(["sudo", "bluetoothctl", "discoverable-timeout", "0"], capture_output=True)
        subprocess.run(["sudo", "bluetoothctl", "pairable-timeout", "0"], capture_output=True)
        subprocess.run(["sudo", "bluetoothctl", "discoverable", "on"], capture_output=True)
        subprocess.run(["sudo", "bluetoothctl", "pairable", "on"], capture_output=True)
        
        sio.emit("pi-log", {"level": "info", "message": "Bluetooth discoverability enabled."})
        
        # Fallback for older systems to force name change and discoverability
        subprocess.run(["sudo", "hciconfig", "hci0", "up"], capture_output=True)
        subprocess.run(["sudo", "hciconfig", "hci0", "name", "LEDPI"], capture_output=True)
        subprocess.run(["sudo", "hciconfig", "hci0", "piscan"], capture_output=True)
        
        # Try nmcli first (Raspberry Pi OS Bookworm+)
        try:
            existing = subprocess.run(["sudo", "nmcli", "connection", "show"], capture_output=True, text=True)
            if "bt-pan" in existing.stdout:
                nmcli_res = subprocess.run(["sudo", "nmcli", "connection", "up", "bt-pan"], capture_output=True, text=True)
                if nmcli_res.returncode != 0:
                    sio.emit("pi-log", {"level": "error", "message": f"nmcli up failed: {nmcli_res.stderr}"})
            else:
                nmcli_res = subprocess.run(["sudo", "nmcli", "connection", "add", "type", "bluetooth", "autoconnect", "yes", "bt-type", "nap", "ipv4.method", "shared", "ipv4.address", "10.0.0.1/24", "ipv6.method", "ignore", "con-name", "bt-pan"], capture_output=True, text=True)
                if nmcli_res.returncode != 0:
                    sio.emit("pi-log", {"level": "error", "message": f"nmcli add failed: {nmcli_res.stderr}"})
            sio.emit("status-update", {"type": "success", "message": "Bluetooth Hotspot Enabled! Connect phone via Bluetooth, then open http://10.0.0.1:3000"})
            sio.emit("pi-log", {"level": "info", "message": "nmcli PAN setup complete."})
        except Exception as e1:
            sio.emit("pi-log", {"level": "warning", "message": f"nmcli failed, trying bt-network: {str(e1)}"})
            # Fallback to bt-network (older OS)
            subprocess.Popen(["sudo", "bt-network", "-s", "nap", "pan0"])
            # We also need to assign an IP to pan0 in this case, but it's complex without dnsmasq.
            # We'll just run it and hope they have a bridge or dhcp setup.
            time.sleep(2)
            subprocess.run(["sudo", "ifconfig", "pan0", "10.0.0.1", "up"], capture_output=True)
            sio.emit("status-update", {"type": "success", "message": "Bluetooth Hotspot (bt-network) Started! Connect phone, then open http://10.0.0.1:3000"})
            sio.emit("pi-log", {"level": "info", "message": "bt-network PAN setup complete."})
            
        sio.emit("system-status", get_system_status())
    except Exception as e:
        sio.emit("pi-log", {"level": "error", "message": f"Failed to enable BT PAN: {str(e)}"})
        sio.emit("status-update", {"type": "error", "message": f"Failed to enable BT PAN: {str(e)}"})

@sio.on('toggle-bt-config')
def on_toggle_bt_config(enabled):
    if enabled:
        sio.emit("status-update", {"type": "success", "message": "Bluetooth Config Portal Enabled. Connect via phone."})
    else:
        sio.emit("status-update", {"type": "info", "message": "Bluetooth Config Portal Disabled."})

@sio.on('request-reboot')
def on_reboot():
    sio.emit("status-update", {"type": "info", "message": "Rebooting Pi..."})
    time.sleep(1)
    os.system("sudo reboot")

@sio.on('request-shutdown')
def on_shutdown():
    sio.emit("status-update", {"type": "info", "message": "Shutting down Pi..."})
    time.sleep(1)
    os.system("sudo shutdown -h now")

if __name__ == '__main__':
    print(f"Connecting to {SERVER_URL} to fetch initial settings...")
    
    try:
        import urllib.request
        import json
    except:
        pass

    settings_received = threading.Event()
    is_initial_settings = True
    
    @sio.on('update-settings')
    def on_update_settings(new_settings):
        global settings, is_initial_settings
        print("Received settings:", new_settings)
        
        old_hw = settings.get("hardware", {})
        new_hw = new_settings.get("hardware", {})
        old_rt = settings.get("runtime", {})
        new_rt = new_settings.get("runtime", {})
        
        hw_changed = (old_hw != new_hw) or (old_rt != new_rt)
        
        settings.update(new_settings)
        
        if is_initial_settings:
            is_initial_settings = False
            settings_received.set()
        elif hw_changed and HAS_MATRIX:
            print("Hardware settings changed! Restarting matrix script...")
            sio.emit("status-update", {"type": "info", "message": "Hardware changed. Restarting matrix display..."})
            time.sleep(1)
            import sys
            os.execv(sys.executable, ['python3'] + sys.argv)
        else:
            if matrix:
                try:
                    matrix.brightness = int(settings.get("brightness", 100))
                except:
                    pass

    def connect_and_wait():
        while not settings_received.is_set():
            try:
                sio.connect(SERVER_URL)
                # Wait up to 5 seconds for settings to arrive
                settings_received.wait(5)
                if not settings_received.is_set():
                    sio.disconnect()
            except Exception as e:
                print(f"Connection failed: {e}. Retrying in 2s...")
                time.sleep(2)

    print("Waiting for server connection to load hardware config...")
    connect_and_wait()
    
    print("Initializing Matrix with server settings...")
    init_matrix()
    
    print("Starting draw thread...")
    draw_thread = threading.Thread(target=draw_loop, daemon=True)
    draw_thread.start()
    
    print("Starting background tasks thread...")
    bg_thread = threading.Thread(target=background_tasks, daemon=True)
    bg_thread.start()
    
    # Keep main thread alive
    sio.wait()
