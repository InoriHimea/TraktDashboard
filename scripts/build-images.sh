#!/usr/bin/env bash
set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
REGISTRY="${REGISTRY:-ghcr.io/inorihimea}"
PUSH="${PUSH:-false}"
TARGET="${TARGET:-all}"   # all | api | web

# Resolve repo root regardless of where the script is called from
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Extract version from root package.json
VERSION=$(grep -m1 '"version"' "${REPO_ROOT}/package.json" | sed 's/.*"version": "\(.*\)".*/\1/')
if [[ -z "${VERSION}" ]]; then
  echo "✗ Failed to extract version from package.json" >&2
  exit 1
fi

API_IMAGE_BASE="${REGISTRY}/trakt-dashboard-api"
WEB_IMAGE_BASE="${REGISTRY}/trakt-dashboard-web"

API_IMAGE_VERSIONED="${API_IMAGE_BASE}:${VERSION}"
API_IMAGE_LATEST="${API_IMAGE_BASE}:latest"

WEB_IMAGE_VERSIONED="${WEB_IMAGE_BASE}:${VERSION}"
WEB_IMAGE_LATEST="${WEB_IMAGE_BASE}:latest"

# ─── Helpers ──────────────────────────────────────────────────────────────────
log()  { echo "  $*"; }
step() { echo; echo "▶ $*"; }
die()  { echo "✗ $*" >&2; exit 1; }

# ─── Build ────────────────────────────────────────────────────────────────────
build_api() {
  step "Building API image → ${API_IMAGE_VERSIONED} + latest"
  docker build \
    --file "${REPO_ROOT}/apps/api/Dockerfile" \
    --tag "${API_IMAGE_VERSIONED}" \
    --tag "${API_IMAGE_LATEST}" \
    --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --label "org.opencontainers.image.version=${VERSION}" \
    --label "org.opencontainers.image.revision=$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo unknown)" \
    "${REPO_ROOT}"
  log "Built ${API_IMAGE_VERSIONED}"
  log "Tagged ${API_IMAGE_LATEST}"
}

build_web() {
  step "Building Web image → ${WEB_IMAGE_VERSIONED} + latest"
  docker build \
    --file "${REPO_ROOT}/apps/web/Dockerfile" \
    --tag "${WEB_IMAGE_VERSIONED}" \
    --tag "${WEB_IMAGE_LATEST}" \
    --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --label "org.opencontainers.image.version=${VERSION}" \
    --label "org.opencontainers.image.revision=$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo unknown)" \
    "${REPO_ROOT}"
  log "Built ${WEB_IMAGE_VERSIONED}"
  log "Tagged ${WEB_IMAGE_LATEST}"
}

push_images() {
  local versioned="$1"
  local latest="$2"
  step "Pushing ${versioned}"
  docker push "${versioned}"
  log "Pushed ${versioned}"
  step "Pushing ${latest}"
  docker push "${latest}"
  log "Pushed ${latest}"
}

# ─── Main ─────────────────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════╗"
echo "║     trakt-dashboard image builder    ║"
echo "╚══════════════════════════════════════╝"
log "Registry : ${REGISTRY}"
log "Version  : ${VERSION}"
log "Push     : ${PUSH}"
log "Target   : ${TARGET}"

case "${TARGET}" in
  all)
    build_api
    build_web
    if [[ "${PUSH}" == "true" ]]; then
      push_images "${API_IMAGE_VERSIONED}" "${API_IMAGE_LATEST}"
      push_images "${WEB_IMAGE_VERSIONED}" "${WEB_IMAGE_LATEST}"
    fi
    ;;
  api)
    build_api
    [[ "${PUSH}" == "true" ]] && push_images "${API_IMAGE_VERSIONED}" "${API_IMAGE_LATEST}"
    ;;
  web)
    build_web
    [[ "${PUSH}" == "true" ]] && push_images "${WEB_IMAGE_VERSIONED}" "${WEB_IMAGE_LATEST}"
    ;;
  *)
    die "Unknown target '${TARGET}'. Use: all | api | web"
    ;;
esac

echo
echo "✓ Done"
echo
log "Images built:"
case "${TARGET}" in
  all)
    log "  - ${API_IMAGE_VERSIONED}"
    log "  - ${API_IMAGE_LATEST}"
    log "  - ${WEB_IMAGE_VERSIONED}"
    log "  - ${WEB_IMAGE_LATEST}"
    ;;
  api)
    log "  - ${API_IMAGE_VERSIONED}"
    log "  - ${API_IMAGE_LATEST}"
    ;;
  web)
    log "  - ${WEB_IMAGE_VERSIONED}"
    log "  - ${WEB_IMAGE_LATEST}"
    ;;
esac
