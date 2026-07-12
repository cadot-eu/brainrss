#!/usr/bin/env bash
# shellcheck disable=SC2317
# ============================================================
# import-opml.sh — Importe un fichier OPML dans BrainRSS
#
# Usage:
#   ./import-opml.sh fichier.opml
#   ./import-opml.sh fichier.opml --host http://192.168.1.10:3000
#   cat fichier.opml | ./import-opml.sh
# ============================================================

# Configuration
HOST_EXPLICIT=0
if [[ -n "${BRAINRSS_HOST:-}" ]]; then
    HOST="$BRAINRSS_HOST"
    HOST_EXPLICIT=1
else
    HOST="http://localhost:3000"
fi
OPML_FILE=""

# Fonction d'aide
usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS] [FICHIER.opml]

Importe les flux RSS d'un fichier OPML dans BrainRSS.

Options:
  --host URL       URL du serveur BrainRSS (défaut: http://localhost:3000)
                   Peut aussi être défini via BRAINRSS_HOST
  -h, --help       Affiche cette aide

Exemples:
  $(basename "$0") mes_flux.opml
  $(basename "$0") mes_flux.opml --host http://192.168.1.10:3000
  BRAINRSS_HOST=http://192.168.1.10:3000 $(basename "$0") mes_flux.opml
  cat mes_flux.opml | $(basename "$0")
EOF
    exit 0
}

# Parsing des arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --host)
            HOST="$2"
            HOST_EXPLICIT=1
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        -*)
            echo "Option inconnue: $1"
            usage
            ;;
        *)
            OPML_FILE="$1"
            shift
            ;;
    esac
done

# Lire depuis stdin si aucun fichier fourni
if [[ -z "$OPML_FILE" ]]; then
    if [[ -t 0 ]]; then
        echo "Erreur: Aucun fichier OPML fourni et rien sur stdin."
        usage
    fi
    OPML_CONTENT=$(cat)
else
    if [[ ! -f "$OPML_FILE" ]]; then
        echo "Erreur: Fichier '$OPML_FILE' introuvable."
        exit 1
    fi
    OPML_CONTENT=$(cat "$OPML_FILE")
fi

# ============================================================
# Auto-détection du serveur BrainRSS via Docker
# ============================================================
auto_detect_host() {
    local detected_ip

    # Méthode 1: docker inspect sur le container nommé "brainrss"
    detected_ip=$(docker inspect brainrss 2>/dev/null | \
        sed -n '/"IPAddress"/{s/.*"IPAddress": "\([^"]*\)".*/\1/p;q}')
    if [[ -n "$detected_ip" ]] && [[ "$detected_ip" != "0.0.0.0" ]] && [[ "$detected_ip" != "" ]]; then
        HOST="http://$detected_ip:3000"
        return 0
    fi

    # Méthode 2: docker compose (si lancé depuis le dossier du projet)
    local cid
    cid=$(docker compose ps -q brainrss 2>/dev/null | head -1)
    if [[ -n "$cid" ]]; then
        detected_ip=$(docker inspect "$cid" 2>/dev/null | \
            sed -n '/"IPAddress"/{s/.*"IPAddress": "\([^"]*\)".*/\1/p;q}')
        if [[ -n "$detected_ip" ]] && [[ "$detected_ip" != "0.0.0.0" ]] && [[ "$detected_ip" != "" ]]; then
            HOST="http://$detected_ip:3000"
            return 0
        fi
    fi

    # Méthode 3: chercher tout container dont l'image contient "brainrss"
    detected_ip=$(docker ps --filter "name=brainrss" --format '{{.ID}}' 2>/dev/null | head -1 | \
        xargs -r docker inspect 2>/dev/null | \
        sed -n '/"IPAddress"/{s/.*"IPAddress": "\([^"]*\)".*/\1/p;q}')
    if [[ -n "$detected_ip" ]] && [[ "$detected_ip" != "0.0.0.0" ]] && [[ "$detected_ip" != "" ]]; then
        HOST="http://$detected_ip:3000"
        return 0
    fi

    return 1
}

# Vérifier que le serveur est accessible (avec auto-détection si nécessaire)
check_connectivity() {
    local host_to_check="$1"
    if curl -sf -o /dev/null --connect-timeout 3 "$host_to_check/api/feeds" 2>/dev/null; then
        return 0
    fi
    return 1
}

echo "→ Vérification de la connexion à $HOST ..."

if check_connectivity "$HOST"; then
    echo "  ✓ Serveur accessible ($HOST)"
elif [[ "$HOST_EXPLICIT" -eq 0 ]]; then
    echo "  ⚠ $HOST inaccessible, tentative d'auto-détection Docker..."
    if auto_detect_host; then
        echo "  → Nouvelle tentative sur $HOST ..."
        if check_connectivity "$HOST"; then
            echo "  ✓ Serveur accessible via Docker ($HOST)"
        else
            echo "Erreur: Impossible de joindre le serveur BrainRSS à $HOST"
            echo "       Vérifiez que le container est bien lancé et que l'API répond."
            exit 1
        fi
    else
        echo "Erreur: Aucun container brainrss trouvé dans Docker."
        echo "       Lancez l'application avec 'docker compose up -d' ou 'npm run dev'"
        exit 1
    fi
else
    echo "Erreur: Impossible de joindre le serveur BrainRSS à $HOST"
    echo "       Vérifiez l'URL ou lancez l'application."
    exit 1
fi

# Extraire les flux de l'OPML
echo "→ Analyse du fichier OPML ..."

FEED_URLS=()
FEED_TITLES=()

# Fonction d'extraction : grep + sed (standard POSIX, pas de -P)
extract_feeds() {
    local content="$1"
    # Trouve toutes les balises <outline> contenant xmlUrl
    echo "$content" | grep -o '<outline[^>]*xmlUrl="[^"]*"[^>]*>' 2>/dev/null | while IFS= read -r line; do
        # Extraire xmlUrl
        url=$(echo "$line" | sed -n 's/.*xmlUrl="\([^"]*\)".*/\1/p')
        # Extraire title ou text (priorité à title)
        title=$(echo "$line" | sed -n 's/.*title="\([^"]*\)".*/\1/p')
        if [[ -z "$title" ]]; then
            title=$(echo "$line" | sed -n 's/.*text="\([^"]*\)".*/\1/p')
        fi
        if [[ -n "$url" ]]; then
            echo "${title:-Sans titre}|${url}"
        fi
    done
}

if command -v xmllint &>/dev/null; then
    echo "  (utilisation de xmllint)"
    while IFS='|' read -r title url; do
        if [[ -n "$url" ]]; then
            FEED_TITLES+=("$title")
            FEED_URLS+=("$url")
        fi
    done < <(echo "$OPML_CONTENT" | xmllint --xpath '//outline[@xmlUrl]/@xmlUrl|//outline[@xmlUrl]/@title|//outline[@xmlUrl]/@text' - 2>/dev/null | \
        sed 's/xmlUrl="\([^"]*\)"/\nURL:\1\n/g' | \
        sed 's/title="\([^"]*\)"/\nTITLE:\1\n/g' | \
        sed 's/text="\([^"]*\)"/\nTITLE:\1\n/g' | \
        grep -E '^(URL|TITLE):' | \
        awk -F':' '
            /^TITLE:/ { title=substr($0,7); next }
            /^URL:/   { url=substr($0,5); print title"|"url; title="" }
        ')
else
    echo "  (utilisation de grep/sed)"
    while IFS='|' read -r title url; do
        if [[ -n "$url" ]]; then
            FEED_TITLES+=("$title")
            FEED_URLS+=("$url")
        fi
    done < <(extract_feeds "$OPML_CONTENT")
fi

TOTAL=${#FEED_URLS[@]}

if [[ $TOTAL -eq 0 ]]; then
    echo "  ✗ Aucun flux RSS trouvé dans le fichier OPML."
    exit 0
fi

echo "  ✓ $TOTAL flux trouvé(s)"
echo ""

# Importer chaque flux
SUCCESS=0
SKIPPED=0
FAILED=0
ERRORS=()

for i in $(seq 0 $((TOTAL - 1))); do
    url="${FEED_URLS[$i]}"
    title="${FEED_TITLES[$i]:-Sans titre}"

    printf "  [%2d/%2d] Import de « %s » ... " "$((i+1))" "$TOTAL" "${title:0:50}"

    # Construire le JSON en échappant les " et \
    json_url=$(echo "$url" | sed 's/\\/\\\\/g; s/"/\\"/g')

    # Appeler l'API
    response=$(curl -s --connect-timeout 10 --max-time 30 \
        -w '\n%{http_code}' -X POST "$HOST/api/feeds" \
        -H 'Content-Type: application/json' \
        -d "{\"url\": \"$json_url\"}" 2>&1) || {
        echo "✗ Échec réseau"
        FAILED=$((FAILED + 1))
        ERRORS+=("$title: échec réseau (curl)")
        continue
    }

    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')

    case "$http_code" in
        201)
            echo "✓ OK"
            SUCCESS=$((SUCCESS + 1))
            ;;
        400)
            err_msg=$(echo "$body" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')
            if echo "$err_msg" | grep -qiE 'UNIQUE|duplicate|already exist|déjà|existe' 2>/dev/null; then
                echo "⚠ Doublon (déjà importé)"
                SKIPPED=$((SKIPPED + 1))
            else
                echo "✗ Erreur: ${err_msg:-Requête invalide}"
                FAILED=$((FAILED + 1))
                ERRORS+=("$title: $err_msg")
            fi
            ;;
        000)
            echo "✗ Timeout ou échec réseau"
            FAILED=$((FAILED + 1))
            ERRORS+=("$title: timeout")
            ;;
        *)
            echo "✗ HTTP $http_code"
            FAILED=$((FAILED + 1))
            ERRORS+=("$title: HTTP $http_code")
            ;;
    esac
done

# Résumé
echo ""
echo "═══════════════════════════════════════════"
echo "  Importation terminée"
echo "  ✓ $SUCCESS nouveau(x) flux importé(s)"
if [[ $SKIPPED -gt 0 ]]; then
    echo "  ⚠ $SKIPPED doublon(s) ignoré(s)"
fi
if [[ $FAILED -gt 0 ]]; then
    echo "  ✗ $FAILED échec(s)"
    for err in "${ERRORS[@]}"; do
        echo "    - $err"
    done
fi
echo "═══════════════════════════════════════════"
