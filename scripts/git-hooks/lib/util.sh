#!/usr/bin/env bash
# Shared utilities for git hooks.
# ANSI colors work in Git Bash (Windows), macOS, Linux, and WSL.

_RED='\033[0;31m'
_GREEN='\033[0;32m'
_YELLOW='\033[0;33m'
_BLUE='\033[0;34m'
_BOLD='\033[1m'
_RESET='\033[0m'

echo_header() { echo -e "\n${_BOLD}${_BLUE}>${_RESET} ${_BOLD}$1${_RESET}"; }
echo_ok()     { echo -e "${_GREEN}ok${_RESET} $1"; }
echo_err()    { echo -e "${_RED}FAIL${_RESET} $1" >&2; }
echo_warn()   { echo -e "${_YELLOW}warn${_RESET} $1"; }
