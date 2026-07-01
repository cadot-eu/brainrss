#!/usr/bin/env bash
# ============================================================
# reset-unread.sh — Remet tous les articles en « non lus »
# ============================================================
DB="${1:-data/brainrss.db}"

if [[ ! -f "$DB" ]]; then
  echo "Erreur: base '$DB' introuvable."
  exit 1
fi

COUNT_BEFORE=$(sqlite3 "$DB" "SELECT COUNT(*) FROM articles WHERE read = 1;" 2>/dev/null)

if sqlite3 "$DB" "UPDATE articles SET read = 0;" 2>/dev/null; then
  COUNT_AFTER=$(sqlite3 "$DB" "SELECT COUNT(*) FROM articles WHERE read = 0;" 2>/dev/null)
  echo "✓ $COUNT_BEFORE article(s) remis en non lus."
  echo "  Total non lus : $COUNT_AFTER"
else
  echo "Erreur: base en lecture seule. Essaie : sudo bash $0"
  exit 1
fi
