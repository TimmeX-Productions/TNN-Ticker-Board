import socketio
import psutil
import subprocess
import time
import threading
import json
import os
from PIL import Image, ImageDraw, ImageFont
from rgbmatrix import RGBMatrix, RGBMatrixOptions, graphics

# --- Configuration ---
SERVER_URL = 'http://YOUR_SERVER_IP:3000' # Change this to your server's IP
# ---------------------

sio = socketio.Client()

# Global state
current_message = ""
current_news = None
matrix = None
canvas = None
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
    "mode": "scroll"
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

def draw_loop():
    global canvas, current_message, current_news
    
    font = graphics.Font()
    font.LoadFont("../../../fonts/7x13.bdf") # Ensure you have a font file here or use a default path
    
    pos = canvas.width
    
    while True:
        canvas.Clear()
        
        color_rgb = hex_to_rgb(settings.get("color", "#ffffff"))
        text_color = graphics.Color(color_rgb[0], color_rgb[1], color_rgb[2])
        
        display_text = current_message
        if not display_text and current_news:
            display_text = f"NEWS: {current_news.get('title', '')}"
            
        if not display_text:
            display_text = "Waiting for messages..."

        if settings.get("mode") == "static":
            graphics.DrawText(canvas, font, 0, 20, text_color, display_text)
        else: # scroll
            len = graphics.DrawText(canvas, font, pos, 20, text_color, display_text)
            pos -= 1
            if (pos + len < 0):
                pos = canvas.width

        canvas = matrix.SwapOnVSync(canvas)
        
        # Speed control (0-100) -> delay
        speed = settings.get("speed", 50)
        delay = max(0.01, (100 - speed) * 0.001)
        time.sleep(delay)

def get_system_status():
    net = psutil.net_if_stats()
    network = "Connected" if "wlan0" in net and net["wlan0"].is_up else "Disconnected"
    try:
        bt_status = subprocess.check_output(["rfkill", "list", "bluetooth"]).decode()
        bluetooth = "On" if "Soft blocked: no" in bt_status else "Off"
    except:
        bluetooth = "Unknown"
    return {"network": network, "bluetooth": bluetooth}

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
        results = subprocess.check_output(["nmcli", "-t", "-f", "SSID", "dev", "wifi"]).decode().split('\n')
        sio.emit("wifi-scan-results", list(set([r for r in results if r])))
    except Exception as e:
        print("WiFi scan failed:", e)

@sio.on('request-scan-bluetooth')
def on_scan_bluetooth():
    try:
        # Basic bluetoothctl scan simulation
        sio.emit("bluetooth-scan-results", ["Device1", "Device2"])
    except:
        pass

@sio.on('request-connect-wifi')
def on_connect_wifi(data):
    try:
        subprocess.run(["nmcli", "dev", "wifi", "connect", data['ssid'], "password", data['password']], check=True)
        sio.emit("connection-status", {"type": "wifi", "status": "success", "message": f"Connected to {data['ssid']}"})
    except Exception as e:
        sio.emit("connection-status", {"type": "wifi", "status": "error", "message": f"Failed: {str(e)}"})

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
