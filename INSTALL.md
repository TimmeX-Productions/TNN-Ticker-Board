# TNN Ticker Board - Raspberry Pi Installation Guide

Follow these step-by-step instructions to install and configure the LED Matrix client on your Raspberry Pi. This guide assumes you have already flashed **Raspberry Pi OS Lite (64-bit or 32-bit)** onto an SD card and have connected your Pi to your network.

## Step 1: SSH into your Raspberry Pi

Open a terminal (Mac/Linux) or Command Prompt/PowerShell (Windows) and connect to your Pi:

```bash
ssh pi@<YOUR_PI_IP_ADDRESS>
```
*(Replace `pi` with your actual username if you changed it during the Raspberry Pi Imager setup, and `<YOUR_PI_IP_ADDRESS>` with the Pi's local IP address).*

---

## Step 2: Clone the Repository

Once logged in, download the project files directly from the GitHub repository:

```bash
# Move to your home directory
cd ~

# Clone the repository
git clone https://github.com/TimmeX-Productions/TNN-Ticker-Board.git

# Enter the project directory
cd TNN-Ticker-Board
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

1. Open the client script in a text editor:
```bash
nano pi_client/matrix_client.py
```

2. Find the `SERVER_URL` line near the top of the file:
```python
# --- Configuration ---
SERVER_URL = 'http://YOUR_SERVER_IP:3000' # Change this to your server's IP
# ---------------------
```

3. Change it to the URL where your web dashboard is deployed (e.g., `https://my-ticker-app.com` or your local server IP).
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

## Step 7: Run on Boot (Systemd Service)

To ensure the matrix client starts automatically every time you plug in the Pi, set it up as a background service.

1. Create a new service file:
```bash
sudo nano /etc/systemd/system/ticker.service
```

2. Paste the following configuration into the file. **Important:** If your Raspberry Pi username is NOT `pi`, change `pi` to your actual username in the `ExecStart` and `WorkingDirectory` paths!

```ini
[Unit]
Description=TNN Ticker Board Client
After=network-online.target
Wants=network-online.target

[Service]
# The matrix library requires root privileges to access GPIO pins
User=root
WorkingDirectory=/home/pi/TNN-Ticker-Board/pi_client
ExecStart=/usr/bin/python3 /home/pi/TNN-Ticker-Board/pi_client/matrix_client.py
StandardOutput=inherit
StandardError=inherit
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

3. Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

4. Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ticker.service
sudo systemctl start ticker.service
```

5. Check the status to ensure it's running correctly:
```bash
sudo systemctl status ticker.service
```
*(You should see "Active: active (running)" and logs indicating it is connecting to your server).*

---

## Troubleshooting

*   **Matrix is flickering or glitching:** Ensure you selected "Quality" during the Adafruit script to disable onboard audio. If it still flickers, go to your Web Dashboard -> Display Settings -> Hardware Configuration, and increase the **GPIO Slowdown** (Try `4` for Pi 4, or `5` for Pi 5).
*   **Colors are swapped (e.g., Red is Blue):** Go to Web Dashboard -> Display Settings -> Advanced Timing, and change the **Hardware Mapping** or toggle **Inverse Colors**.
*   **Checking Logs:** If the matrix isn't turning on, check the background service logs by running:
    ```bash
    sudo journalctl -u ticker.service -f
    ```
