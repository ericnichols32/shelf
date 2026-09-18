#!/bin/zsh
# Install (or reinstall) the daily LEGO wish list sync on this Mac.
#
#   zsh scripts/install-lego-sync.sh           install and schedule
#   zsh scripts/install-lego-sync.sh --now     ...and run it once straight away
#   zsh scripts/install-lego-sync.sh --remove  stop it for good
set -e
LABEL=com.ericnichols.shelf-lego-sync
DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
KEY="$HOME/.config/shelf/service-account.json"
HERE="${0:A:h}"

if [[ "$1" == "--remove" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$DEST"
  echo "Removed. The daily LEGO sync will not run again."
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs" "$HOME/.config/shelf"
cp "$HERE/$LABEL.plist" "$DEST"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$DEST"
echo "Scheduled: every day at 9am. Log: ~/Library/Logs/shelf-lego-sync.log"

if [[ ! -f "$KEY" ]]; then
  echo
  echo "One thing left: the service-account key is not at $KEY yet."
  echo "Until it is, each run will read LEGO fine and then stop before writing."
fi

if [[ "$1" == "--now" ]]; then
  echo; echo "Running once now..."
  launchctl kickstart -k "gui/$(id -u)/$LABEL"
  sleep 12
  tail -n 25 "$HOME/Library/Logs/shelf-lego-sync.log"
fi
