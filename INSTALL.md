# Raspberry Pi LED Matrix Controller - Installation Guide

This guide will walk you through setting up your Raspberry Pi to run the LED Matrix client, which connects to the web dashboard for real-time control.

## 1. Hardware Requirements
*   **Raspberry Pi** (Pi 3, 4, or 5 recommended for smooth scrolling).
*   **RGB LED Matrix Panel(s)** (e.g., 64x32, 64x64).
*   **Adafruit RGB Matrix Bonnet or HAT** (Highly recommended for stable GPIO timing).
*   **5V Power Supply** (Make sure it provides enough Amps for your panels, typically 4A+ per panel).

## 2. OS Preparation
1.  Install **Raspberry Pi OS Lite (64-bit)** using the Raspberry Pi Imager.
2.  Enable SSH and configure your initial Wi-Fi network during the imaging process.
3.  Boot the Pi and SSH into it.

## 3. Install the RGB Matrix Library
The client relies on the excellent `hzeller/rpi-rgb-led-matrix` library.

```bash
curl https://raw.githubusercontent.com/adafruit/Raspberry-Pi-Installer-Scripts/main/rgb-matrix.sh >rgb-matrix.sh
sudo bash rgb-matrix.sh
```
*During the script, select the appropriate options for your hardware (e.g., Adafruit HAT with PWM mod).*

## 4. Install Client Dependencies
Install the required Python packages and system utilities:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip python3-dev python3-pillow git network-manager bluez -y
sudo pip3 install python-socketio[client] psutil requests --break-system-packages
```

## 5. Download the Client Script
Download the `matrix_client.py` script to your Pi.

```bash
mkdir -p ~/matrix_controller
cd ~/matrix_controller
# Download the script (replace with your actual raw URL if hosted on GitHub)
wget https://raw.githubusercontent.com/YOUR_REPO/pi_client/matrix_client.py
```

**Important:** Edit `matrix_client.py` and change `SERVER_URL` to the URL of your deployed web dashboard.
```bash
nano matrix_client.py
# Change SERVER_URL = 'http://YOUR_SERVER_IP:3000'
```

## 6. Download a Font
The script requires a font file to draw text.
```bash
mkdir -p ~/matrix_controller/fonts
cd ~/matrix_controller/fonts
wget https://raw.githubusercontent.com/hzeller/rpi-rgb-led-matrix/master/fonts/7x13.bdf
cd ..
```

## 7. Run as a Systemd Service
To ensure the matrix client starts automatically on boot and runs in the background:

1. Create a service file:
```bash
sudo nano /etc/systemd/system/matrix.service
```

2. Paste the following configuration (adjust `User` and `WorkingDirectory` if your username isn't `pi`):
```ini
[Unit]
Description=LED Matrix Controller Client
After=network.target

[Service]
ExecStart=/usr/bin/python3 /home/pi/matrix_controller/matrix_client.py
WorkingDirectory=/home/pi/matrix_controller
StandardOutput=inherit
StandardError=inherit
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```
*(Note: The script runs as root because the `rpi-rgb-led-matrix` library requires root access to directly manipulate GPIO pins).*

3. Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable matrix.service
sudo systemctl start matrix.service
```

4. Check the status:
```bash
sudo systemctl status matrix.service
```

## 8. Troubleshooting
*   **Flickering/Glitches:** Ensure you have disabled the onboard audio if you are using the hardware PWM pin. The Adafruit script usually handles this. Adjust the `gpio_slowdown` setting in the web dashboard (try 4 for Pi 4, 5 for Pi 5).
*   **Colors are wrong:** Change the `led_rgb_sequence` or `scan_mode` in the Display Settings tab.
*   **Cannot connect to server:** Verify the `SERVER_URL` in `matrix_client.py` and ensure your Pi has internet access.
