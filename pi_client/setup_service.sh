#!/bin/bash

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./setup_service.sh)"
  exit
fi

SERVICE_FILE="/etc/systemd/system/tnn-ticker.service"
APP_DIR=$(dirname $(dirname $(realpath $0)))
PI_CLIENT_DIR="$APP_DIR/pi_client"

echo "Setting up TNN Ticker Board as a systemd service..."

cat <<EOF > $SERVICE_FILE
[Unit]
Description=TNN Ticker Board Matrix Client
After=network.target

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

systemctl daemon-reload
systemctl enable tnn-ticker.service
systemctl start tnn-ticker.service

echo "Service installed and started!"
echo "You can check the status with: sudo systemctl status tnn-ticker.service"
echo "You can view logs with: sudo journalctl -u tnn-ticker.service -f"
