#!/bin/zsh
# Install (or reinstall) the hourly LEGO + Nintendo sync on this Mac.
#
#   zsh scripts/install-sync.sh           install and schedule
#   zsh scripts/install-sync.sh --now     ...and show the first run
#   zsh scripts/install-sync.sh --remove  stop it for good
set -e
LABEL=com.ericnichols.shelf-sync
OLD=com.ericnichols.shelf-lego-sync
DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/shelf-sync.log"
HERE="${0:A:h}"
uid=$(id -u)

# The earlier, LEGO-only daily job is replaced by this one.
launchctl bootout "gui/$uid/$OLD" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$OLD.plist"

if [[ "$1" == "--remove" ]]; then
  launchctl bootout "gui/$uid/$LABEL" 2>/dev/null || true
  rm -f "$DEST"
  echo "Removed. Neither wish list will sync again."
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cp "$HERE/$LABEL.plist" "$DEST"
launchctl bootout "gui/$uid/$LABEL" 2>/dev/null || true
: > "$LOG"
launchctl bootstrap "gui/$uid" "$DEST"
echo "Scheduled: LEGO and Nintendo, every hour. Log: ~/Library/Logs/shelf-sync.log"

if [[ "$1" == "--now" ]]; then
  echo; echo "First run (it starts on install)..."
  sleep 20
  tail -n 12 "$LOG"
fi
