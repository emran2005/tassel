@echo off
rem Starts Tassel. Double-click me.
cd /d "%~dp0"
if not exist node_modules\electron\dist\electron.exe (
  echo Setting up Tassel for the first time...
  call npm install
  node node_modules\electron\install.js
)
start "" node_modules\electron\dist\electron.exe .
