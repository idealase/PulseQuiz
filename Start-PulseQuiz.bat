@echo off
title PulseQuiz Server
powershell -ExecutionPolicy Bypass -File "%~dp0run-server.ps1"
pause
