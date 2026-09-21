#!/bin/bash
# deploy.sh — รันบน VM1 เพื่ออัปเดต app
set -e

APP_DIR="/home/ubuntu/sales-tracking-qr (1)"
APP_NAME="sales-tracking"

cd "$APP_DIR"

echo "==> git pull..."
git pull origin main

echo "==> npm install (ถ้ามี package เปลี่ยน)..."
npm install --omit=dev

echo "==> pm2 restart..."
pm2 restart $APP_NAME --update-env

echo "==> done! status:"
pm2 status $APP_NAME
