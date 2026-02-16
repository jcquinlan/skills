#!/usr/bin/env bash
# Install skills, agents, and hooks from this repo into the global
# Claude Code config directory (~/.claude/).
#
# Usage:
#   bash install.sh          # install everything
#   bash install.sh --dry-run  # preview what would be installed

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

# --- Helpers ---

installed=0
skipped=0

log()  { printf '  %s\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; installed=$((installed + 1)); }
skip() { printf '  \033[33m-\033[0m %s (already up to date)\n' "$1"; skipped=$((skipped + 1)); }
dry()  { printf '  \033[36m→\033[0m %s\n' "$1"; }

# Copy a file, creating parent dirs as needed.
# Skips if destination already matches source.
install_file() {
  local src="$1" dst="$2" label="$3"

  if [[ "$DRY_RUN" == true ]]; then
    dry "$label"
    return
  fi

  if [[ -f "$dst" ]] && diff -q "$src" "$dst" &>/dev/null; then
    skip "$label"
    return
  fi

  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  ok "$label"
}

# --- Skills ---

echo "Installing skills..."

for skill_dir in "$REPO_DIR"/.claude/skills/*/; do
  [[ -d "$skill_dir" ]] || continue
  name="$(basename "$skill_dir")"
  skill_file="$skill_dir/SKILL.md"
  [[ -f "$skill_file" ]] || continue

  install_file "$skill_file" "$CLAUDE_DIR/skills/$name/SKILL.md" "skill: $name"
done

# --- Agents ---

if [[ -d "$REPO_DIR/.claude/agents" ]]; then
  echo "Installing agents..."
  for agent_file in "$REPO_DIR"/.claude/agents/*.md; do
    [[ -f "$agent_file" ]] || continue
    name="$(basename "$agent_file")"
    install_file "$agent_file" "$CLAUDE_DIR/agents/$name" "agent: $name"
  done
fi

# --- Hooks ---

if [[ -d "$REPO_DIR/.claude/hooks" ]]; then
  echo "Installing hooks..."
  for hook_file in "$REPO_DIR"/.claude/hooks/*; do
    [[ -f "$hook_file" ]] || continue
    name="$(basename "$hook_file")"
    install_file "$hook_file" "$CLAUDE_DIR/hooks/$name" "hook: $name"
    # Preserve executable bit
    if [[ "$DRY_RUN" == false ]] && [[ -x "$hook_file" ]]; then
      chmod +x "$CLAUDE_DIR/hooks/$name"
    fi
  done
fi

# --- Hook config in settings.json ---

SETTINGS="$CLAUDE_DIR/settings.json"

merge_hook_config() {
  if ! command -v jq &>/dev/null; then
    log "Warning: jq not found — skipping hook config merge into settings.json"
    log "You may need to manually add the Stop hook to $SETTINGS"
    return
  fi

  local repo_settings="$REPO_DIR/.claude/settings.json"
  [[ -f "$repo_settings" ]] || return

  # Check if repo settings defines any hooks
  local repo_hooks
  repo_hooks=$(jq -r '.hooks // empty' "$repo_settings")
  [[ -n "$repo_hooks" ]] || return

  # Ensure global settings.json exists
  if [[ ! -f "$SETTINGS" ]]; then
    if [[ "$DRY_RUN" == true ]]; then
      dry "hook config: would create $SETTINGS with hook entries"
      return
    fi
    mkdir -p "$(dirname "$SETTINGS")"
    echo '{}' > "$SETTINGS"
  fi

  # Check if the Stop hook is already configured
  local existing_hooks
  existing_hooks=$(jq -r '.hooks.Stop // empty' "$SETTINGS")

  if [[ -n "$existing_hooks" ]]; then
    # Check if our specific hook command already exists in the Stop array
    local our_command="bash .claude/hooks/stop-hook.sh"
    local already_present
    already_present=$(jq --arg cmd "$our_command" \
      '[.hooks.Stop[]?.hooks[]? | select(.command == $cmd)] | length' \
      "$SETTINGS" 2>/dev/null || echo "0")

    if [[ "$already_present" -gt 0 ]]; then
      skip "hook config: Stop hook already registered in settings.json"
      return
    fi
  fi

  if [[ "$DRY_RUN" == true ]]; then
    dry "hook config: would add Stop hook to $SETTINGS"
    return
  fi

  # Merge: add our hook entries from repo settings into global settings
  # We append to the Stop hooks array (or create it)
  local repo_stop_hooks
  repo_stop_hooks=$(jq '.hooks.Stop' "$repo_settings")

  jq --argjson new_hooks "$repo_stop_hooks" \
    '.hooks.Stop = ((.hooks.Stop // []) + $new_hooks | unique_by(.hooks[0].command))' \
    "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"

  ok "hook config: Stop hook registered in settings.json"
}

echo "Checking hook config..."
merge_hook_config

# --- Summary ---

echo ""
if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run complete. No files were changed."
else
  echo "Done. Installed $installed, skipped $skipped (already current)."
fi
