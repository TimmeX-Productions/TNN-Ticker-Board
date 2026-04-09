import socketio
import psutil
import subprocess
import time
import threading
import json
import os
import socket
import urllib.request
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
from rgbmatrix import RGBMatrix, RGBMatrixOptions, graphics

# --- Configuration ---
# Defaulting to localhost so it works out-of-the-box on the Pi
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
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def init_matrix():
    global matrix, canvas
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

def load_image(url):
    global current_image, last_image_url
    if url == last_image_url:
        return
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            img_data = response.read()
            img = Image.open(BytesIO(img_data)).convert('RGB')
            img.thumbnail((matrix.width, matrix.height), Image.Resampling.LANCZOS)
            current_image = img
            last_image_url = url
    except Exception as e:
        print(f"Failed to load image: {e}")
        current_image = None
        last_image_url = ""

def draw_loop():
    global canvas, current_message, current_news, current_image
    
    font = graphics.Font()
    font_path = f"../../../fonts/{settings.get('font', '7x13.bdf')}"
    if not os.path.exists(font_path):
        font_path = "../../../fonts/7x13.bdf" # fallback
    try:
        font.LoadFont(font_path)
    except:
        pass # If font fails to load, it might crash or just not render text
    
    pos = canvas.width
    bounce_dir = -1
    
    while True:
        canvas.Clear()
        
        # Handle Image
        image_url = settings.get("image_url", "")
        if image_url:
            load_image(image_url)
            if current_image:
                # Center image
                x = (canvas.width - current_image.width) // 2
                y = (canvas.height - current_image.height) // 2
                canvas.SetImage(current_image, x, y)
        
        # Handle Text
        color_rgb = hex_to_rgb(settings.get("color", "#ffffff"))
        text_color = graphics.Color(color_rgb[0], color_rgb[1], color_rgb[2])
        
        display_text = current_message
        if not display_text and current_news and not image_url:
            display_text = f"NEWS: {current_news.get('title', '')}"
            
        if not display_text and not image_url:
            display_text = "Waiting for messages..."

        if display_text:
            mode = settings.get("mode", "scroll")
            text_width = sum([font.CharacterWidth(ord(c)) for c in display_text]) if hasattr(font, 'CharacterWidth') else len(display_text) * 7
            
            y_pos = canvas.height // 2 + 4 # Approximate vertical center
            
            if mode == "static":
                graphics.DrawText(canvas, font, (canvas.width - text_width) // 2, y_pos, text_color, display_text)
            elif mode == "bounce":
                graphics.DrawText(canvas, font, pos, y_pos, text_color, display_text)
                pos += bounce_dir
                if pos < 0 or pos + text_width > canvas.width:
                    bounce_dir *= -1
            elif mode == "flash":
                if int(time.time() * 2) % 2 == 0:
                    graphics.DrawText(canvas, font, (canvas.width - text_width) // 2, y_pos, text_color, display_text)
            else: # scroll
                len_drawn = graphics.DrawText(canvas, font, pos, y_pos, text_color, display_text)
                pos -= 1
                if (pos + text_width < 0):
                    pos = canvas.width

        canvas = matrix.SwapOnVSync(canvas)
        
        # Speed control (0-100) -> delay
        speed = settings.get("speed", 50)
        delay = max(0.01, (100 - speed) * 0.001)
        time.sleep(delay)

def get_system_status():
    net = psutil.net_if_stats()
    addrs = psutil.net_if_addrs()
    
    network = "Disconnected"
    ip_address = "Unknown"
    
    if "wlan0" in net and net["wlan0"].is_up:
        network = "Connected (wlan0)"
        if "wlan0" in addrs:
            for addr in addrs["wlan0"]:
                if addr.family == socket.AF_INET:
                    ip_address = addr.address
    elif "eth0" in net and net["eth0"].is_up:
        network = "Connected (eth0)"
        if "eth0" in addrs:
            for addr in addrs["eth0"]:
                if addr.family == socket.AF_INET:
                    ip_address = addr.address

    try:
        bt_status = subprocess.check_output(["rfkill", "list", "bluetooth"]).decode()
        bluetooth = "On" if "Soft blocked: no" in bt_status else "Off"
    except:
        bluetooth = "Unknown"
        
    return {"network": network, "ip_address": ip_address, "bluetooth": bluetooth}

@sio.event
def connect():
    print("Connected to server!")
    sio.emit("system-status", get_system_status())

@sio.on('update-settings')
def on_update_settings(new_settings):
    global settings
    print("Received new settings:", new_settings)
    settings.update(new_settings)
    if matrix:
        matrix.brightness = int(settings.get("brightness", 100))

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
    try:
        # Force a rescan first so we get fresh networks
        subprocess.run(["nmcli", "dev", "wifi", "rescan"], timeout=5)
        results = subprocess.check_output(["nmcli", "-t", "-f", "SSID", "dev", "wifi"]).decode().split('\n')
        sio.emit("wifi-scan-results", list(set([r for r in results if r])))
    except Exception as e:
        print("WiFi scan failed:", e)
        sio.emit("wifi-scan-results", [])

@sio.on('request-scan-bluetooth')
def on_scan_bluetooth():
    try:
        # Start discovery briefly
        subprocess.Popen(["bluetoothctl", "scan", "on"])
        time.sleep(4) # Wait a bit for devices to populate
        subprocess.Popen(["bluetoothctl", "scan", "off"])
        
        results = subprocess.check_output(["bluetoothctl", "devices"]).decode().split('\n')
        devices = []
        for r in results:
            if r.startswith("Device"):
                parts = r.split(' ', 2)
                if len(parts) >= 3:
                    devices.append(parts[2])
        sio.emit("bluetooth-scan-results", list(set(devices)))
    except Exception as e:
        print("Bluetooth scan failed:", e)
        sio.emit("bluetooth-scan-results", [])

@sio.on('request-connect-wifi')
def on_connect_wifi(data):
    try:
        subprocess.run(["nmcli", "dev", "wifi", "connect", data['ssid'], "password", data['password']], check=True)
        sio.emit("connection-status", {"type": "wifi", "status": "success", "message": f"Connected to {data['ssid']}"})
        sio.emit("system-status", get_system_status())
    except Exception as e:
        sio.emit("connection-status", {"type": "wifi", "status": "error", "message": f"Failed: {str(e)}"})

@sio.on('request-pair-bluetooth')
def on_pair_bluetooth(data):
    try:
        # Find MAC address from name
        results = subprocess.check_output(["bluetoothctl", "devices"]).decode().split('\n')
        mac = None
        for r in results:
            if data['device'] in r:
                mac = r.split(' ')[1]
                break
        if mac:
            subprocess.run(["bluetoothctl", "pair", mac], check=True)
            subprocess.run(["bluetoothctl", "trust", mac], check=True)
            sio.emit("connection-status", {"type": "bluetooth", "status": "success", "message": f"Paired with {data['device']}"})
        else:
            sio.emit("connection-status", {"type": "bluetooth", "status": "error", "message": "Device MAC not found"})
    except Exception as e:
        sio.emit("connection-status", {"type": "bluetooth", "status": "error", "message": f"Failed: {str(e)}"})

@sio.on('toggle-bt-config')
def on_toggle_bt_config(enabled):
    # Stub for enabling a BLE GATT server for phone configuration
    if enabled:
        print("Enabling Bluetooth Config Portal...")
        # Here you would start a BLE server script (e.g., using bluezero or pybleno)
        sio.emit("status-update", {"type": "success", "message": "Bluetooth Config Portal Enabled. Connect via phone."})
    else:
        print("Disabling Bluetooth Config Portal...")
        # Here you would stop the BLE server script
        sio.emit("status-update", {"type": "info", "message": "Bluetooth Config Portal Disabled."})

@sio.on('request-reboot')
def on_reboot():
    subprocess.run(["sudo", "reboot"])

@sio.on('request-shutdown')
def on_shutdown():
    subprocess.run(["sudo", "shutdown", "-h", "now"])

@sio.on('request-health')
def on_health():
    cpu = psutil.cpu_percent()
    temp = 0
    try:
        temp_str = subprocess.check_output(["vcgencmd", "measure_temp"]).decode()
        temp = float(temp_str.replace("temp=", "").replace("'C\n", ""))
    except:
        pass
    sio.emit("health-update", {"cpu": cpu, "temp": temp})

if __name__ == '__main__':
    print("Initializing Matrix...")
    init_matrix()
    
    print("Starting draw thread...")
    draw_thread = threading.Thread(target=draw_loop, daemon=True)
    draw_thread.start()
    
    print(f"Connecting to {SERVER_URL}...")
    while True:
        try:
            sio.connect(SERVER_URL)
            sio.wait()
        except Exception as e:
            print(f"Connection failed: {e}. Retrying in 5s...")
            time.sleep(5)
