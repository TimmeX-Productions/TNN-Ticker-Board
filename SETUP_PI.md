# Raspberry Pi Setup Guide for LED Matrix Ticker

This guide helps you set up your Raspberry Pi to act as the client for your LED Matrix Ticker Controller.

## 1. Hardware Preparation
Ensure your LED matrix is correctly wired to your Raspberry Pi GPIO pins.

## 2. Software Installation
Run the following commands on your Raspberry Pi:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip python3-dev git network-manager bluez -y
pip3 install rpi-rgb-led-matrix python3-pillow python-socketio[client] psutil
```

## 3. The Client Script (`ticker_client.py`)
Create `ticker_client.py`. **Replace `YOUR_APP_URL` with your actual app URL.**

```python
import socketio
import psutil
import subprocess
import time
from rgbmatrix import RGBMatrix, RGBMatrixOptions

# Matrix Configuration
options = RGBMatrixOptions()
options.rows = 32
options.cols = 64
matrix = RGBMatrix(options=options)

sio = socketio.Client()

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
    while True:
        sio.emit("system-status", get_system_status())
        time.sleep(30)

@sio.on('request-scan-wifi')
def on_scan_wifi():
    results = subprocess.check_output(["nmcli", "-t", "-f", "SSID", "dev", "wifi"]).decode().split('\n')
    sio.emit("wifi-scan-results", [r for r in results if r])

@sio.on('request-scan-bluetooth')
def on_scan_bluetooth():
    sio.emit("bluetooth-scan-results", ["Device1", "Device2"])

@sio.on('request-connect-wifi')
def on_connect_wifi(data):
    # Use nmcli to connect
    sio.emit("status-update", {"type": "success", "message": f"Connected to {data['ssid']}"})

@sio.on('request-pair-bluetooth')
def on_pair_bluetooth(data):
    # Use bluetoothctl to pair
    sio.emit("status-update", {"type": "success", "message": f"Paired with {data['device']}"})

@sio.on('request-reboot')
def on_reboot():
    subprocess.run(["sudo", "reboot"])

@sio.on('request-shutdown')
def on_shutdown():
    subprocess.run(["sudo", "shutdown", "-h", "now"])

@sio.on('request-health')
def on_health():
    cpu = psutil.cpu_percent()
    temp = 45.0 # Simplified
    sio.emit("health-update", {"cpu": cpu, "temp": temp})

sio.connect('https://YOUR_APP_URL')
sio.wait()
```
