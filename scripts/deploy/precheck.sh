#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '[PASS] %s\n' "$1"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  printf '[WARN] %s\n' "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf '[FAIL] %s\n' "$1"
}

printf 'Deployment precheck (%s)\n' "$(date '+%Y-%m-%d %H:%M:%S')"

if [ -f "firebase.json" ]; then
  pass "firebase.json exists"
else
  fail "firebase.json is missing"
fi

if [ -f ".firebaserc" ]; then
  if grep -q 'your-firebase-project-id' .firebaserc; then
    fail ".firebaserc still contains placeholder project id"
  else
    pass ".firebaserc exists and is not placeholder"
  fi
else
  fail ".firebaserc is missing (copy from .firebaserc.example)"
fi

if [ -f "functions/.env" ]; then
  pass "functions/.env exists"
else
  warn "functions/.env is missing (copy from functions/.env.example)"
fi

if [ -f "frontend/.env" ]; then
  pass "frontend/.env exists"
else
  warn "frontend/.env is missing (copy from frontend/.env.example)"
fi

if command -v firebase >/dev/null 2>&1; then
  pass "firebase CLI is installed"
else
  fail "firebase CLI is not installed"
fi

if command -v firebase >/dev/null 2>&1; then
  firebase projects:list >/tmp/firebase_projects_list.txt 2>&1 || true
  PROJECTS_OUTPUT="$(cat /tmp/firebase_projects_list.txt)"

  if printf '%s' "$PROJECTS_OUTPUT" | grep -q 'Authentication Error'; then
    fail "firebase auth is invalid (run: firebase login --reauth)"
  elif printf '%s' "$PROJECTS_OUTPUT" | grep -q 'Failed to list Firebase projects'; then
    fail "firebase projects could not be listed (check network/auth)"
  elif printf '%s' "$PROJECTS_OUTPUT" | grep -q 'Preparing the list of your Firebase projects'; then
    pass "firebase project access looks available"
  else
    warn "could not fully confirm firebase auth status"
  fi

  firebase use >/tmp/firebase_use.txt 2>&1 || true
  USE_OUTPUT="$(cat /tmp/firebase_use.txt)"

  if printf '%s' "$USE_OUTPUT" | grep -q 'No active project'; then
    fail "no active Firebase project (run: firebase use --add)"
  elif printf '%s' "$USE_OUTPUT" | grep -q 'Active Project:'; then
    pass "active Firebase project is set"
  else
    warn "could not confirm active Firebase project"
  fi
fi

printf '\nSummary: %s pass, %s warn, %s fail\n' "$PASS_COUNT" "$WARN_COUNT" "$FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi

