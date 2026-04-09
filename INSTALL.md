# TNN Ticker Board - Raspberry Pi Installation Guide

Follow these step-by-step instructions to install and configure the LED Matrix client on your Raspberry Pi. This guide assumes you have already flashed **Raspberry Pi OS Lite (64-bit or 32-bit)** onto an SD card and have connected your Pi to your network.

## Step 1: SSH into your Raspberry Pi

Open a terminal (Mac/Linux) or Command Prompt/PowerShell (Windows) and connect to your Pi:

```bash
ssh ledpi@<YOUR_PI_IP_ADDRESS>
```
*(Replace `ledpi` with your actual username if you changed it during the Raspberry Pi Imager setup, and `<YOUR_PI_IP_ADDRESS>` with the Pi's local IP address).*

---

## Step 2: Install Git and Clone the Repository

Before you can download the project, you need to ensure `git` is installed on your Raspberry Pi.

```bash
# Update package list and install git
sudo apt update
sudo apt install git -y

# Move to your home directory
cd ~

# Clone the repository
# IMPORTANT: Replace the URL below with YOUR actual GitHub repository URL 
# after you export this project from AI Studio to your GitHub account.
git clone https://github.com/TimmeX-Productions/TNN-Ticker-Board.git

# Enter the project directory
cd TNN-Ticker-Board

# Make sure you have the absolute latest code that we just built!
git pull
```

---

## Step 3: Install the RGB Matrix Library

The client relies on the `hzeller/rpi-rgb-led-matrix` library to communicate with the GPIO pins. The easiest way to install this and configure your Pi's hardware is using the Adafruit script:

```bash
curl https://raw.githubusercontent.com/adafruit/Raspberry-Pi-Installer-Scripts/main/rgb-matrix.sh >rgb-matrix.sh
sudo bash rgb-matrix.sh
```

**During the script:**
1. Select **"Adafruit RGB Matrix Bonnet"** or **"Adafruit RGB Matrix HAT"** depending on your hardware.
2. Select **"Quality"** (this disables the onboard audio to prevent matrix flickering, which is highly recommended).
3. When asked to reboot, select **Yes**.

---

## Step 4: Install Python Dependencies

After the Pi reboots, SSH back into it and install the required system packages and Python libraries:

```bash
# Re-enter the directory
cd ~/TNN-Ticker-Board

# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required system tools
sudo apt install python3-pip python3-dev python3-pillow git network-manager bluez -y

# Install Python dependencies (using --break-system-packages for modern Pi OS environments)
sudo pip3 install python-socketio[client] psutil requests --break-system-packages
```

---

## Step 5: Configure the Client

You need to tell the Raspberry Pi where your web dashboard is hosted so it can connect and receive commands.

1. Open the client script in a text editor. **Note: Linux is case-sensitive! It is `pi_client` (all lowercase).**
```bash
nano pi_client/matrix_client.py
```

2. Find the `SERVER_URL` line near the top of the file:
```python
# --- Configuration ---
SERVER_URL = 'http://YOUR_SERVER_IP:3000' # Change this to your server's IP
# ---------------------
```

3. Change it to the URL where your web dashboard is deployed (e.g., `http://127.0.0.1:3000` if running on the same Pi).
4. Save and exit (Press `Ctrl+O`, `Enter`, then `Ctrl+X`).

---

## Step 6: Download a Font

The script requires a default font to draw text. Let's download the standard `7x13.bdf` font into the correct directory:

```bash
mkdir -p fonts
cd fonts
wget https://raw.githubusercontent.com/hzeller/rpi-rgb-led-matrix/master/fonts/7x13.bdf
cd ..
```

---

## Step 7: Install Node.js and the Web Dashboard

To run the web interface on port 3000, you need Node.js installed.

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install the web dashboard dependencies
cd ~/TNN-Ticker-Board
npm install

# Build the production website files
npm run build
```

---

## Step 8: Run on Boot (Systemd Services)

To ensure both the matrix client and the web dashboard start automatically every time you plug in the Pi, set them up as background services.

### 1. The Matrix Client Service
Create the service file:
```bash
sudo nano /etc/systemd/system/ticker.service
```

Paste the following configuration. **Note: Linux is case-sensitive! Use `pi_client` not `Pi_Client`.**
```ini
[Unit]
Description=TNN Ticker Board Client
After=network-online.target
Wants=network-online.target

[Service]
# The matrix library requires root privileges to access GPIO pins
User=root
WorkingDirectory=/home/ledpi/TNN-Ticker-Board/pi_client
ExecStart=/usr/bin/python3 /home/ledpi/TNN-Ticker-Board/pi_client/matrix_client.py
StandardOutput=inherit
StandardError=inherit
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```
Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

### 2. The Web Dashboard Service
Create the service file:
```bash
sudo nano /etc/systemd/system/ticker-web.service
```

Paste the following configuration:
```ini
[Unit]
Description=TNN Ticker Board Web Dashboard
After=network-online.target

[Service]
User=ledpi
WorkingDirectory=/home/ledpi/TNN-Ticker-Board
# Use the absolute path to npm
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```
Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

### 3. Enable and Start Both Services
```bash
sudo systemctl daemon-reload
sudo systemctl enable ticker.service
sudo systemctl enable ticker-web.service
sudo systemctl start ticker.service
sudo systemctl start ticker-web.service
```

### 4. Check Status
To see if they are running correctly:
```bash
sudo systemctl status ticker.service
sudo systemctl status ticker-web.service
```
*(You should see "Active: active (running)" for both).*
