#!/bin/bash

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./setup_services.sh)"
  exit
fi

APP_DIR=$(realpath $(dirname $0))
PI_CLIENT_DIR="$APP_DIR/pi_client"

echo "Setting up TNN Ticker Board Services..."

# 1. Setup Node.js Server Service
NODE_SERVICE_FILE="/etc/systemd/system/tnn-server.service"

# Find node path
NODE_PATH=$(which node)
if [ -z "$NODE_PATH" ]; then
    # Fallback if node isn't in root's path
    NODE_PATH="/usr/bin/node"
fi

cat <<EOF > $NODE_SERVICE_FILE
[Unit]
Description=TNN Ticker Board Node Server
After=network.target

[Service]
ExecStart=$NODE_PATH $APP_DIR/node_modules/.bin/tsx $APP_DIR/server.ts
WorkingDirectory=$APP_DIR
StandardOutput=inherit
StandardError=inherit
Restart=always
User=pi
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 2. Setup Python Matrix Client Service
PYTHON_SERVICE_FILE="/etc/systemd/system/tnn-matrix.service"

cat <<EOF > $PYTHON_SERVICE_FILE
[Unit]
Description=TNN Ticker Board Matrix Client
After=network.target tnn-server.service

[Service]
ExecStart=/usr/bin/python3 $PI_CLIENT_DIR/matrix_client.py http://127.0.0.1:3000
WorkingDirectory=$PI_CLIENT_DIR
StandardOutput=inherit
StandardError=inherit
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable services
echo "Enabling and starting services..."
systemctl daemon-reload

systemctl enable tnn-server.service
systemctl start tnn-server.service

systemctl enable tnn-matrix.service
systemctl start tnn-matrix.service

echo "======================================================="
echo "Setup Complete!"
echo "The Ticker Board will now start automatically on boot."
echo ""
echo "To check server status: sudo systemctl status tnn-server"
echo "To check matrix status: sudo systemctl status tnn-matrix"
echo "To view server logs:    sudo journalctl -u tnn-server -f"
echo "To view matrix logs:    sudo journalctl -u tnn-matrix -f"
echo "======================================================="
