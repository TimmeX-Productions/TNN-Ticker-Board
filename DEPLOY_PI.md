# Raspberry Pi Deployment Guide

This guide provides instructions to deploy your LED Matrix Controller on a Raspberry Pi.

## 1. Prerequisites
Ensure your Raspberry Pi is running a recent version of Raspberry Pi OS (Debian-based).

## 2. Install Node.js & npm
Install the latest Node.js LTS version:

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify the installation:
```bash
node -v
npm -v
```

## 3. Prepare the Application
1.  Copy your project files to the Raspberry Pi (e.g., via `scp` or `git clone`).
2.  Navigate to the project directory:
    ```bash
    cd /path/to/your/project
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Build the application:
    ```bash
    npm run build
    ```

## 4. Run the Application
Start the production server:
```bash
npm start
```

The application will now be running on port 3000.

## 5. Accessing the Dashboard
1.  Find your Raspberry Pi's local IP address:
    ```bash
    hostname -I
    ```
2.  Open a web browser on any device on the same network and navigate to:
    `http://<YOUR_PI_IP_ADDRESS>:3000`

## 6. Keeping it Running (Optional but Recommended)
To ensure the application runs automatically on boot, use `pm2`:

```bash
sudo npm install -g pm2
pm2 start npm --name "led-matrix" -- start
pm2 save
pm2 startup
```
Follow the instructions provided by `pm2 startup` to complete the setup.
