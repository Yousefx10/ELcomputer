#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
REMOTE_SCRIPT="$SCRIPT_DIR/deploy-remote.sh"
CONFIG_FILE="${DEPLOY_CONFIG_FILE:-$PROJECT_ROOT/.deploy.env}"

readonly DEPLOY_USER="newelcomputer"
readonly DEPLOY_PATH="/home/newelcomputer/htdocs/new.elcomputer.net"
readonly PM2_APP="new-elcomputer"
readonly REMOTE_HEALTHCHECK_URL="http://127.0.0.1:3001/"
readonly PUBLIC_HEALTHCHECK_URL="https://new.elcomputer.net/"

ARCHIVE_PATH=""
EMPTY_ENV_FILE=""
REMOTE_STAGING_NAME=""
REMOTE_STAGING_CREATED=0
REMOTE_INSTALL_STARTED=0
SSH_TARGET=""
SSH_ARGS=()
SCP_ARGS=()
EVIDENCE_DIR=""
PHASE="prerequisites"
MANUAL_COMPLETE=0

record_local_evidence() {
  node - "$EVIDENCE_DIR" "$PHASE" "$1" "$ARCHIVE_PATH" "$REMOTE_STAGING_NAME" "$REMOTE_SCRIPT" "${BASH_SOURCE[0]}" <<'NODE'
const fs = require('node:fs'), crypto = require('node:crypto'), path = require('node:path')
const [directory, phase, status, archive, staging, ...scripts] = process.argv.slice(2)
const fingerprint = (file) => fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null
fs.writeFileSync(path.join(directory, 'deployment.json'), JSON.stringify({
  timestamp: new Date().toISOString(), recoveryMode: 'manual', phase, status,
  archive, archiveSha256: fingerprint(archive), remoteStaging: staging,
  scripts: scripts.map(file => ({ file, sha256: fingerprint(file) }))
}, null, 2) + '\n', { mode: 0o600 })
NODE
}

log() {
  printf '\n==> %s\n' "$1"
}

warn() {
  printf 'Warning: %s\n' "$1" >&2
}

die() {
  printf 'Deployment failed: %s\n' "$1" >&2
  exit 1
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM HUP
  set +e

  if [[ "${RECOVERY_MODE:-automatic}" == "manual" && "$status" == "0" && "$MANUAL_COMPLETE" != "1" ]]; then
    status=1
    warn "Manual-recovery invocation exited before verified completion."
  fi

  if [[ "${RECOVERY_MODE:-automatic}" == "manual" && -n "$EVIDENCE_DIR" ]]; then
    record_local_evidence "$status" || warn "Could not update local diagnostic evidence."
    warn "Manual recovery: local archive and diagnostics retained at $EVIDENCE_DIR (archive: $ARCHIVE_PATH)."
  elif [[ -n "$ARCHIVE_PATH" && -f "$ARCHIVE_PATH" ]]; then
    rm -f -- "$ARCHIVE_PATH"
  fi

  if [[ -n "$EMPTY_ENV_FILE" && -f "$EMPTY_ENV_FILE" ]]; then
    rm -f -- "$EMPTY_ENV_FILE"
  fi

  if [[ "${RECOVERY_MODE:-automatic}" != "manual" && "$REMOTE_STAGING_CREATED" == "1" && "$REMOTE_INSTALL_STARTED" == "0" && -n "$SSH_TARGET" ]]; then
    remote_run cleanup "$REMOTE_STAGING_NAME" >/dev/null 2>&1 \
      || warn "Could not remove the remote staging directory."
  fi

  if [[ "${RECOVERY_MODE:-automatic}" == "manual" && "$status" != "0" ]]; then
    warn "STOP: automatic output restoration is disabled. Downtime is possible. Recovery or a compatible forward fix requires separate human authorization."
    [[ -z "$REMOTE_STAGING_NAME" ]] || warn "Preserve remote artifacts: $DEPLOY_PATH/$REMOTE_STAGING_NAME and $DEPLOY_PATH/${BACKUP_NAME:-unknown}."
  fi

  exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

usage() {
  cat <<'EOF'
Usage:
  bash scripts/deploy.sh
  bash scripts/deploy.sh --check
  bash scripts/deploy.sh --manual-recovery
  bash scripts/deploy.sh --check --manual-recovery

Options:
  --check   Validate local and remote deployment prerequisites only.
  --manual-recovery  Preserve artifacts; never restore old output automatically.
                     A failed release may cause downtime pending human recovery.
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

require_value() {
  local name=$1
  [[ -n "${!name:-}" ]] || die "$name is required in $CONFIG_FILE"
}

validate_configuration() {
  require_value DEPLOY_HOST

  [[ "$DEPLOY_HOST" =~ ^[A-Za-z0-9.-]+$ ]] \
    || die "DEPLOY_HOST must be an SSH hostname, IPv4 address, or SSH alias."
  [[ "$DEPLOY_PORT" =~ ^[0-9]+$ ]] && (( DEPLOY_PORT >= 1 && DEPLOY_PORT <= 65535 )) \
    || die "DEPLOY_PORT must be between 1 and 65535."
  [[ "$DEPLOY_BACKUP_RETENTION" =~ ^[0-9]+$ ]] && (( DEPLOY_BACKUP_RETENTION >= 1 && DEPLOY_BACKUP_RETENTION <= 50 )) \
    || die "DEPLOY_BACKUP_RETENTION must be between 1 and 50."
  [[ "$DEPLOY_HEALTH_RETRIES" =~ ^[0-9]+$ ]] && (( DEPLOY_HEALTH_RETRIES >= 1 && DEPLOY_HEALTH_RETRIES <= 60 )) \
    || die "DEPLOY_HEALTH_RETRIES must be between 1 and 60."
  [[ "$DEPLOY_HEALTH_DELAY" =~ ^[0-9]+$ ]] && (( DEPLOY_HEALTH_DELAY >= 1 && DEPLOY_HEALTH_DELAY <= 30 )) \
    || die "DEPLOY_HEALTH_DELAY must be between 1 and 30 seconds."

  if [[ -n "$DEPLOY_IDENTITY_FILE" ]]; then
    DEPLOY_IDENTITY_FILE="${DEPLOY_IDENTITY_FILE/#\~/$HOME}"
    [[ -f "$DEPLOY_IDENTITY_FILE" ]] \
      || die "DEPLOY_IDENTITY_FILE does not exist: $DEPLOY_IDENTITY_FILE"
  fi
}

configure_ssh() {
  SSH_TARGET="$DEPLOY_USER@$DEPLOY_HOST"
  SSH_ARGS=(
    -p "$DEPLOY_PORT"
    -o BatchMode=yes
    -o ConnectTimeout=10
    -o ServerAliveInterval=15
    -o ServerAliveCountMax=3
  )
  SCP_ARGS=(
    -P "$DEPLOY_PORT"
    -o BatchMode=yes
    -o ConnectTimeout=10
  )

  if [[ -n "$DEPLOY_IDENTITY_FILE" ]]; then
    SSH_ARGS+=(-i "$DEPLOY_IDENTITY_FILE" -o IdentitiesOnly=yes)
    SCP_ARGS+=(-i "$DEPLOY_IDENTITY_FILE" -o IdentitiesOnly=yes)
  fi
}

remote_run() {
  local remote_command="bash -s --"
  local argument escaped

  for argument in "$@"; do
    printf -v escaped '%q' "$argument"
    remote_command+=" $escaped"
  done

  ssh "${SSH_ARGS[@]}" "$SSH_TARGET" "$remote_command" < "$REMOTE_SCRIPT"
}

validate_project() {
  [[ -f "$PROJECT_ROOT/package.json" ]] || die "package.json was not found."
  [[ -f "$REMOTE_SCRIPT" ]] || die "Remote deployment helper was not found."

  node - "$PROJECT_ROOT/package.json" <<'NODE'
const fs = require('node:fs')
const packagePath = process.argv[2]
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))

if (packageJson.scripts?.build !== 'nuxt build') {
  console.error('The expected "nuxt build" script was not found.')
  process.exit(1)
}

if (!packageJson.dependencies?.nuxt) {
  console.error('This does not appear to be the Nuxt project.')
  process.exit(1)
}
NODE

  if command -v git >/dev/null 2>&1 && git -C "$PROJECT_ROOT" ls-files --error-unmatch .env >/dev/null 2>&1; then
    die ".env is tracked by Git. Remove it from Git before deploying."
  fi
}

validate_output_symlinks() {
  local link_path link_target resolved_path

  while IFS= read -r link_path; do
    link_target="$(readlink -- "$link_path")" \
      || die "Could not inspect symlink in .output: $link_path"
    resolved_path="$(cd -- "$(dirname -- "$link_path")" && realpath "$link_target")" \
      || die "Broken symlink found in .output: $link_path"
    [[ "$resolved_path" == "$PROJECT_ROOT/.output/"* ]] \
      || die "A symlink in .output points outside the deployment output: $link_path"
  done < <(find "$PROJECT_ROOT/.output" -type l -print)
}

scan_output_for_local_secrets() {
  [[ -f "$PROJECT_ROOT/.env" ]] || return 0

  node - "$PROJECT_ROOT/.env" "$PROJECT_ROOT/.output" <<'NODE'
const fs = require('node:fs')
const path = require('node:path')
const { parseEnv } = require('node:util')

const envPath = process.argv[2]
const outputPath = process.argv[3]
const values = parseEnv(fs.readFileSync(envPath, 'utf8'))
const sensitiveName = /(KEY|SECRET|TOKEN|PASSWORD|DAFTRA_ACCOUNT_URL|SUPABASE_URL)/i
const candidates = Object.entries(values)
  .filter(([name, value]) => sensitiveName.test(name) && typeof value === 'string' && value.length >= 12)
  .map(([name, value]) => ({ name, bytes: Buffer.from(value) }))

const files = []
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(entryPath)
    else if (entry.isFile()) files.push(entryPath)
  }
}

walk(outputPath)
const found = new Set()
for (const file of files) {
  const contents = fs.readFileSync(file)
  for (const candidate of candidates) {
    if (contents.includes(candidate.bytes)) found.add(candidate.name)
  }
}

if (found.size) {
  console.error(`Build contains local environment values from: ${[...found].sort().join(', ')}`)
  process.exit(1)
}
NODE
}

build_application() {
  local -a application_env_vars=(
    NUXT_PUBLIC_SUPABASE_URL
    NUXT_PUBLIC_SUPABASE_KEY
    NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    NUXT_PUBLIC_SUPABASE_ANON_KEY
    SUPABASE_URL
    SUPABASE_KEY
    SUPABASE_PUBLISHABLE_KEY
    SUPABASE_ANON_KEY
    SUPABASE_SERVICE_ROLE_KEY
    NUXT_SUPABASE_SERVICE_ROLE_KEY
    CREDENTIALS_ENCRYPTION_KEY
    SHIPPING_CREDENTIALS_ENCRYPTION_KEY
    SHIPPING_WORKER_SECRET
    PDC_LIVE_REQUESTS_ENABLED
    DAFTRA_ACCOUNT_URL
    DAFTRA_API_KEY
    DAFTRA_CLIENT_ID
    UPLOADS_DIR
  )

  EMPTY_ENV_FILE="$(mktemp "${TMPDIR:-/tmp}/elcomputer-empty-env.XXXXXX")"

  log "Building without local application secrets..."
  (
    cd -- "$PROJECT_ROOT"
    unset "${application_env_vars[@]}"
    npm run build -- --dotenv "$EMPTY_ENV_FILE"
  )

  [[ -f "$PROJECT_ROOT/.output/server/index.mjs" ]] \
    || die "Build completed without .output/server/index.mjs. The server was not touched."

  validate_output_symlinks
  scan_output_for_local_secrets
}

package_output() {
  ARCHIVE_PATH="$(mktemp "${TMPDIR:-/tmp}/elcomputer-deploy.XXXXXX")"

  log "Packaging .output only..."
  # macOS stores extended attributes as libarchive PAX records by default.
  # Strip them so the Linux-side path validator sees only .output entries.
  COPYFILE_DISABLE=1 tar --no-xattrs -czf "$ARCHIVE_PATH" -C "$PROJECT_ROOT" .output

  [[ -s "$ARCHIVE_PATH" ]] || die "The deployment archive is empty."
  tar -tzf "$ARCHIVE_PATH" | awk '
    BEGIN { valid = 1 }
    {
      entry = $0
      sub(/^\.\//, "", entry)
      if (entry != ".output" && entry !~ /^\.output\//) valid = 0
      if (entry ~ /(^|\/)\.\.($|\/)/) valid = 0
    }
    END { exit valid ? 0 : 1 }
  ' || die "The archive contains files outside .output."
}

wait_for_public_health() {
  local attempt
  local health_log=""
  if [[ "$RECOVERY_MODE" == "manual" ]]; then
    health_log="$EVIDENCE_DIR/public-health.log"
    (umask 077; : > "$health_log")
  fi

  for (( attempt = 1; attempt <= DEPLOY_HEALTH_RETRIES; attempt++ )); do
    if [[ -n "$health_log" ]]; then
      if curl -fsS --max-time 10 -o /dev/null "$PUBLIC_HEALTHCHECK_URL" 2>>"$health_log"; then
        return 0
      fi
    elif curl -fsS --max-time 10 -o /dev/null "$PUBLIC_HEALTHCHECK_URL"; then
      return 0
    fi

    if (( attempt < DEPLOY_HEALTH_RETRIES )); then
      sleep "$DEPLOY_HEALTH_DELAY"
    fi
  done

  return 1
}

MODE="deploy"
RECOVERY_MODE="automatic"
while (( $# > 0 )); do
  case "$1" in
    --check) MODE="check" ;;
    --manual-recovery) RECOVERY_MODE="manual" ;;
    -h|--help) MANUAL_COMPLETE=1; usage; exit 0 ;;
    *) usage >&2; die "Unknown option: $1" ;;
  esac
  shift
done
# The command line alone selects this mode; configuration cannot change it.
readonly MODE RECOVERY_MODE

require_command npm
require_command node
require_command tar
require_command ssh
require_command scp
require_command curl
require_command realpath

validate_project

[[ -f "$CONFIG_FILE" ]] \
  || die "Create $CONFIG_FILE from .deploy.env.example first."

if grep -Eq '^[[:space:]]*(DEPLOY_USER|DEPLOY_PATH|PM2_APP|REMOTE_HEALTHCHECK_URL|PUBLIC_HEALTHCHECK_URL)[[:space:]]*=' "$CONFIG_FILE"; then
  die ".deploy.env cannot override the locked deployment target. Recopy .deploy.env.example."
fi
if grep -Eq '^[[:space:]]*(export[[:space:]]+)?(MODE|RECOVERY_MODE)[[:space:]]*=' "$CONFIG_FILE"; then
  die ".deploy.env cannot select the deployment or recovery mode. Use command-line options."
fi

# This file is local, ignored by Git, and must contain variable assignments only.
# shellcheck disable=SC1090
source "$CONFIG_FILE"

DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_IDENTITY_FILE="${DEPLOY_IDENTITY_FILE:-}"
DEPLOY_BACKUP_RETENTION="${DEPLOY_BACKUP_RETENTION:-5}"
DEPLOY_HEALTH_RETRIES="${DEPLOY_HEALTH_RETRIES:-15}"
DEPLOY_HEALTH_DELAY="${DEPLOY_HEALTH_DELAY:-2}"

validate_configuration
configure_ssh

log "Checking newelcomputer, the locked site directory, PM2 application, and health endpoint..."
if [[ "$RECOVERY_MODE" == "manual" ]]; then
  CHECK_OUTPUT="$(remote_run check manual)" || die "Remote manual-recovery prerequisite check failed."
  printf '%s\n' "$CHECK_OUTPUT"
  printf '%s\n' "$CHECK_OUTPUT" | grep -Fxq 'ELCOMPUTER_RECOVERY_MODE=manual:v1' \
    || die "Remote helper did not verify manual-recovery mode."
else
  remote_run check
fi

if [[ "$MODE" == "check" ]]; then
  MANUAL_COMPLETE=1
  printf '\nDeployment preflight successful.\n'
  exit 0
fi

if [[ "$RECOVERY_MODE" == "manual" ]]; then
  EVIDENCE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/elcomputer-deploy-evidence.XXXXXX")"
  chmod 700 "$EVIDENCE_DIR"
  record_local_evidence pending
fi
PHASE="build"
build_application
PHASE="package"
package_output

RELEASE_ID="$(date -u +%Y%m%d-%H%M%S)-$$"
REMOTE_STAGING_NAME=".deploy-staging-$RELEASE_ID"
BACKUP_NAME=".output-deploy-backup-$RELEASE_ID"
if [[ "$RECOVERY_MODE" == "manual" ]]; then
  record_local_evidence pending
fi

PHASE="prepare"
log "Preparing remote staging directory..."
remote_run prepare "$REMOTE_STAGING_NAME" "$RECOVERY_MODE"
REMOTE_STAGING_CREATED=1

log "Uploading release package..."
PHASE="upload"
scp "${SCP_ARGS[@]}" "$ARCHIVE_PATH" "$SSH_TARGET:$DEPLOY_PATH/$REMOTE_STAGING_NAME/release.tar.gz"

log "Creating backup and activating release..."
REMOTE_INSTALL_STARTED=1
PHASE="remote-install"
remote_run deploy \
  "$REMOTE_STAGING_NAME" \
  "$RELEASE_ID" \
  "$DEPLOY_BACKUP_RETENTION" \
  "$DEPLOY_HEALTH_RETRIES" \
  "$DEPLOY_HEALTH_DELAY" \
  "$RECOVERY_MODE"
REMOTE_STAGING_CREATED=0

log "Checking public website..."
PHASE="public-health"
if ! wait_for_public_health; then
  if [[ "$RECOVERY_MODE" == "manual" ]]; then
    die "Public HTTPS health failed. Current output and backups preserved; no rollback attempted."
  fi
  warn "Public HTTPS health check failed. Restoring the previous release."
  remote_run rollback \
    "$BACKUP_NAME" \
    "$RELEASE_ID" \
    "$DEPLOY_HEALTH_RETRIES" \
    "$DEPLOY_HEALTH_DELAY" \
    || die "Public health failed and automatic rollback could not be verified."
  die "Public health failed. The previous release was restored."
fi

PHASE="complete"
MANUAL_COMPLETE=1
printf '\nDeployment successful: %s\n' "$PUBLIC_HEALTHCHECK_URL"
printf 'Backup retained on the server: %s/%s\n' "$DEPLOY_PATH" "$BACKUP_NAME"
