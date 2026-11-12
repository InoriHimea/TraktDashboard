#!/bin/sh
set -eu

if [ "$#" -ne 1 ] || [ -z "${1%/}" ]; then
    printf 'FAIL: one nonempty APK mirror is required\n' >&2
    exit 64
fi
mirror=${1%/}

run_stage() {
    stage=$1
    limit=$2
    shift 2
    started=$(date +%s)
    printf 'APK_STAGE_START %s limit_seconds=%s started_epoch=%s\n' "$stage" "$limit" "$started"
    # BusyBox timeout forwards the command/signal status; do not assume GNU's exit 124.
    if busybox timeout -s TERM -k 10 "$limit" "$@"; then
        status=0
    else
        status=$?
    fi
    elapsed=$(( $(date +%s) - started ))
    printf 'APK_STAGE_END %s exit=%s elapsed_seconds=%s limit_seconds=%s\n' \
        "$stage" "$status" "$elapsed" "$limit"
    return "$status"
}

run_stage curl 180 apk add --no-cache curl
run_stage postgres-client 300 apk add --no-cache \
    --repository "$mirror/v3.21/main" \
    --repository "$mirror/v3.21/community" \
    postgresql17-client
run_stage postgres-tools 15 sh -ec 'pg_dump --version; pg_restore --version; psql --version'
