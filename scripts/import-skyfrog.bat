@echo off
chcp 65001 >nul
title SST - Import Skyfrog Jobs

echo ============================================
echo   SST Sales Tracking - Import Skyfrog Jobs
echo ============================================
echo.

:: หา CSV ล่าสุดใน Downloads
set "DOWNLOADS=%USERPROFILE%\Downloads"
set "LATEST_CSV="

for /f "delims=" %%f in ('dir "%DOWNLOADS%\JOBLISTDETAIL*.csv" /b /o-d /a-d 2^>nul') do (
    if not defined LATEST_CSV set "LATEST_CSV=%%f"
)

if not defined LATEST_CSV (
    echo [ERROR] ไม่พบไฟล์ JOBLISTDETAIL*.csv ใน Downloads
    echo กรุณา Export จาก Skyfrog แล้ว Save ไว้ใน Downloads ก่อน
    echo.
    pause
    exit /b 1
)

echo พบไฟล์: %LATEST_CSV%
echo กำลัง import...
echo.

cd /d "%~dp0.."
node scripts/import-skyfrog.js "%DOWNLOADS%\%LATEST_CSV%"

echo.
if %ERRORLEVEL% == 0 (
    echo [สำเร็จ] Import เสร็จเรียบร้อย
) else (
    echo [ERROR] Import ล้มเหลว กรุณาตรวจสอบ
)
echo.
pause
