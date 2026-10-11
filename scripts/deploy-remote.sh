#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

readonly REQUIRED_USER="newelcomputer"
readonly SITE_PATH="/home/newelcomputer/htdocs/new.elcomputer.net"
readonly PM2_APP="new-elcomputer"
readonly PM2_MODE="fork_mode"
readonly PM2_ENTRY="$SITE_PATH/.output/server/index.mjs"
readonly HEALTHCHECK_URL="http://127.0.0.1:3001/"
readonly NODE_BIN_DIR="/home/newelcomputer/.nvm/versions/node/v22.23.1/bin"
readonly NODE_VERSION="v22.23.1"
readonly NODE_EXECUTABLE="$NODE_BIN_DIR/node"
phase="prerequisites"

validate_recovery_mode() {
  [[ "$1" == "automatic" || "$1" == "manual" ]] || die "Invalid recovery mode; refusing deployment."
}

record_remote_evidence() {
  node - "$staging_name" "$backup_name" "$phase" "$1" <<'NODE'
const fs = require('node:fs'), crypto = require('node:crypto'), path = require('node:path')
const [staging, backup, phase, status] = process.argv.slice(2)
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const inventory = root => {
  const entries = []
  const walk = relative => {
    const file = path.join(root, relative), stat = fs.lstatSync(file)
    if (stat.isSymbolicLink()) entries.push({ path: relative, link: fs.readlinkSync(file) })
    else if (stat.isDirectory()) for (const child of fs.readdirSync(file).sort()) walk(path.join(relative, child))
    else if (stat.isFile()) entries.push({ path: relative, sha256: hash(file), bytes: stat.size })
    else throw new Error('Unsupported output entry type')
  }
  if (fs.existsSync(root)) walk('')
  return { root, exists: fs.existsSync(root), entries }
}
const evidence = { timestamp: new Date().toISOString(), recoveryMode: 'manual', phase, status,
  archiveSha256: hash(path.join(staging, 'release.tar.gz')),
  outputs: ['.output', backup, path.join(staging, 'extracted/.output')].map(inventory) }
// Preserve each phase's evidence rather than overwriting the pre-activation hashes.
fs.writeFileSync(path.join(staging, `evidence-${phase}.json`), JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 })
NODE
}

report_manual_failure() {
  record_remote_evidence "$1" || warn "Could not capture final hashes; preserve pre-activation evidence and all artifacts."
  warn "STOP: manual recovery selected. No old output restored and no recovery restart attempted. Downtime is possible."
  warn "Preserved: $SITE_PATH/.output, $SITE_PATH/$backup_name, $SITE_PATH/$staging_name."
  warn "Recovery or a compatible forward fix requires separate human authorization."
}

log() {
  printf '  - %s\n' "$1"
}

warn() {
  printf 'Remote warning: %s\n' "$1" >&2
}

die() {
  printf 'Remote deployment failed: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required server command not found: $1"
}

assert_target_context() {
  local actual_user actual_path

  require_command whoami
  actual_user="$(whoami)"
  [[ "$actual_user" == "$REQUIRED_USER" ]] \
    || die "Expected SSH user $REQUIRED_USER; got $actual_user."
  [[ -d "$SITE_PATH" ]] || die "Target directory does not exist: $SITE_PATH"
  [[ -w "$SITE_PATH" ]] || die "Target directory is not writable: $SITE_PATH"

  cd -- "$SITE_PATH"
  actual_path="$(pwd -P)"
  [[ "$actual_path" == "$SITE_PATH" ]] \
    || die "Resolved directory mismatch. Expected $SITE_PATH; got $actual_path."
}

configure_runtime_tools() {
  [[ -x "$NODE_BIN_DIR/node" ]] || die "Expected Node executable is missing: $NODE_BIN_DIR/node"
  [[ -x "$NODE_BIN_DIR/pm2" ]] || die "Expected PM2 executable is missing: $NODE_BIN_DIR/pm2"

  PATH="$NODE_BIN_DIR:$PATH"
  export PATH
  [[ "$(node --version)" == "$NODE_VERSION" ]] \
    || die "Expected Node $NODE_VERSION from $NODE_BIN_DIR."
}

validate_pm2_app() {
  pm2 jlist | node -e '
    let input = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk) => { input += chunk })
    process.stdin.on("end", () => {
      const [name, expectedMode, expectedEntry, expectedCwd, expectedInterpreter] = process.argv.slice(1)
      const processes = JSON.parse(input)
      const matches = processes.filter((process) => process.name === name)
      if (matches.length !== 1) {
        console.error(`Expected exactly one PM2 application named ${name}; found ${matches.length}.`)
        process.exit(1)
      }

      const environment = matches[0].pm2_env || {}
      const actual = {
        mode: environment.exec_mode,
        entry: environment.pm_exec_path,
        cwd: environment.pm_cwd,
        interpreter: environment.exec_interpreter
      }
      const expected = {
        mode: expectedMode,
        entry: expectedEntry,
        cwd: expectedCwd,
        interpreter: expectedInterpreter
      }
      const mismatches = Object.keys(expected).filter((key) => actual[key] !== expected[key])
      if (mismatches.length) {
        console.error(`PM2 metadata mismatch: ${mismatches.join(", ")}.`)
        process.exit(1)
      }
    })
  ' "$PM2_APP" "$PM2_MODE" "$PM2_ENTRY" "$SITE_PATH" "$NODE_EXECUTABLE" \
    || die "PM2 application identity does not match the locked deployment target."
}

validate_pm2_runtime_environment() {
  pm2 jlist | node -e '
    let input = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk) => { input += chunk })
    process.stdin.on("end", () => {
      const name = process.argv[1]
      const processEntry = JSON.parse(input).find((process) => process.name === name)
      const environment = processEntry?.pm2_env || {}
      const requiredGroups = [
        ["NUXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"],
        [
          "NUXT_PUBLIC_SUPABASE_KEY",
          "NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
          "NUXT_PUBLIC_SUPABASE_ANON_KEY",
          "SUPABASE_PUBLISHABLE_KEY",
          "SUPABASE_ANON_KEY",
          "SUPABASE_KEY"
        ],
        ["NUXT_SUPABASE_SERVICE_ROLE_KEY"]
      ]
      const missing = requiredGroups
        .filter((group) => !group.some((key) => typeof environment[key] === "string" && environment[key].length > 0))
        .map((group) => group.join(" or "))

      if (missing.length) {
        console.error(`Missing PM2 runtime variable groups: ${missing.join("; ")}`)
        process.exit(1)
      }
    })
  ' "$PM2_APP" || die "PM2 lacks required runtime configuration. No values were printed."
}

validate_staging_name() {
  local staging_name=$1
  [[ "$staging_name" =~ ^\.deploy-staging-[0-9]{8}-[0-9]{6}-[0-9]+$ ]] \
    || die "Unsafe staging directory name."
}

validate_release_id() {
  local release_id=$1
  [[ "$release_id" =~ ^[0-9]{8}-[0-9]{6}-[0-9]+$ ]] \
    || die "Unsafe release identifier."
}

validate_backup_name() {
  local backup_name=$1
  [[ "$backup_name" =~ ^\.output-deploy-backup-[0-9]{8}-[0-9]{6}-[0-9]+$ ]] \
    || die "Unsafe backup directory name."
}

validate_positive_integer() {
  local value=$1
  local label=$2
  local maximum=$3

  [[ "$value" =~ ^[0-9]+$ ]] && (( value >= 1 && value <= maximum )) \
    || die "$label must be between 1 and $maximum."
}

wait_for_health() {
  local retries=$1
  local delay=$2
  local attempt
  local health_log=""
  if [[ "${RECOVERY_MODE:-automatic}" == "manual" ]]; then
    health_log="$staging_name/remote-health.log"
    (umask 077; : > "$health_log")
  fi

  for (( attempt = 1; attempt <= retries; attempt++ )); do
    if [[ -n "$health_log" ]]; then
      if curl -fsS --max-time 10 -o /dev/null "$HEALTHCHECK_URL" 2>>"$health_log"; then
        return 0
      fi
    elif curl -fsS --max-time 10 -o /dev/null "$HEALTHCHECK_URL"; then
      return 0
    fi

    if (( attempt < retries )); then
      sleep "$delay"
    fi
  done

  return 1
}

validate_archive() {
  local archive_path=$1
  local entry normalized
  local entry_count=0

  [[ -f "$archive_path" && ! -L "$archive_path" ]] \
    || die "Uploaded release archive is missing or unsafe."

  while IFS= read -r entry; do
    normalized="${entry#./}"
    (( entry_count += 1 ))

    [[ "$normalized" == ".output" || "$normalized" == .output/* ]] \
      || die "Archive contains a path outside .output."
    [[ "$normalized" != ".." && "$normalized" != ../* && "$normalized" != */../* && "$normalized" != */.. ]] \
      || die "Archive contains a parent-directory path."
  done < <(tar -tzf "$archive_path")

  (( entry_count > 0 )) || die "Uploaded release archive is empty."
}

remove_staging_directory() {
  local staging_name=$1

  validate_staging_name "$staging_name"
  [[ ! -e "$staging_name/manual-recovery" ]] || die "Manual-recovery artifacts require separately authorized cleanup."
  if [[ -e "$staging_name" || -L "$staging_name" ]]; then
    [[ -d "$staging_name" && ! -L "$staging_name" ]] \
      || die "Refusing to remove an unsafe staging path."
    rm -rf -- "$staging_name"
  fi
}

restart_and_check() {
  local retries=$1
  local delay=$2

  pm2 restart "$PM2_APP" >/dev/null 2>&1 || return 1
  wait_for_health "$retries" "$delay"
}

rollback_during_deploy() {
  local backup_name=$1
  local staging_name=$2
  local retries=$3
  local delay=$4
  local failed_output="$staging_name/failed-output"
  local rollback_ok=1

  if [[ "$RECOVERY_MODE" == "manual" ]]; then
    die "New release failed; manual recovery forbids automatic output restoration."
  fi
  set +e
  trap - EXIT ERR INT TERM HUP
  warn "New release failed. Starting automatic rollback."

  if [[ -e .output || -L .output ]]; then
    mv -- .output "$failed_output" || rollback_ok=0
  fi

  if [[ -d "$backup_name" && ! -L "$backup_name" ]]; then
    mv -- "$backup_name" .output || rollback_ok=0
  else
    rollback_ok=0
  fi

  if (( rollback_ok == 1 )); then
    restart_and_check "$retries" "$delay" || rollback_ok=0
  fi

  if (( rollback_ok == 1 )); then
    remove_staging_directory "$staging_name" || true
    warn "Rollback completed. The previous release is running."
    exit 1
  fi

  warn "Automatic rollback could not be verified. Inspect PM2 and $PWD immediately."
  exit 2
}

handle_deploy_exit() {
  local status=$?
  trap - EXIT ERR INT TERM HUP
  set +e

  if [[ "$RECOVERY_MODE" == "manual" && "$status" == "0" ]]; then
    status=1
    warn "Manual-recovery invocation exited before verified completion."
  fi
  if (( status == 0 )); then
    return 0
  fi

  if [[ "$RECOVERY_MODE" == "manual" ]]; then
    report_manual_failure "$status"
    exit "$status"
  fi

  if [[ -d "$backup_name" && ! -L "$backup_name" && "$deployment_confirmed" == "0" ]]; then
    rollback_during_deploy "$backup_name" "$staging_name" "$retries" "$delay"
  fi

  if [[ -d "$staging_name" && ! -L "$staging_name" ]]; then
    remove_staging_directory "$staging_name" || true
  fi

  exit "$status"
}

handle_deploy_error() {
  local status=$?
  trap - ERR INT TERM HUP

  # EXIT alone decides recovery, including failures before activation.
  exit "$status"
}

handle_deploy_signal() {
  trap - ERR INT TERM HUP
  exit "$1"
}

cleanup_old_backups() {
  local retention=$1
  local index=0
  local backup
  local -a backups=()

  while IFS= read -r backup; do
    backups+=("$backup")
  done < <(find . -mindepth 1 -maxdepth 1 -type d -name '.output-deploy-backup-*' -print | sort -r)

  for backup in "${backups[@]}"; do
    # Later ordinary releases must not prune a manual-recovery artifact.
    [[ ! -e ".deploy-staging-${backup#./.output-deploy-backup-}/manual-recovery" ]] || continue
    (( index += 1 ))
    if (( index > retention )); then
      backup="${backup#./}"
      if [[ "$backup" =~ ^\.output-deploy-backup-[0-9]{8}-[0-9]{6}-[0-9]+$ && -d "$backup" && ! -L "$backup" ]]; then
        rm -rf -- "$backup" || warn "Could not remove old backup: $backup"
      fi
    fi
  done
}

command_name="${1:-}"
shift || true

case "$command_name" in
  check)
    [[ $# -le 1 ]] || die "Invalid check arguments."
    readonly RECOVERY_MODE="${1:-automatic}"
    validate_recovery_mode "$RECOVERY_MODE"

    assert_target_context
    configure_runtime_tools
    require_command node
    require_command pm2
    require_command curl
    require_command tar
    validate_pm2_app
    validate_pm2_runtime_environment
    [[ -f .output/server/index.mjs ]] \
      || die "Current .output/server/index.mjs does not exist."
    curl -fsS --max-time 30 -o /dev/null "$HEALTHCHECK_URL" \
      || die "Current application did not answer at $HEALTHCHECK_URL"

    log "SSH user verified: $REQUIRED_USER"
    log "Resolved site directory verified: $SITE_PATH"
    log "PM2 application exists: $PM2_APP"
    log "Current production output exists."
    log "Current application health check passed."
    if [[ "$RECOVERY_MODE" == "manual" ]]; then
      printf 'ELCOMPUTER_RECOVERY_MODE=manual:v1\n'
    fi
    ;;

  prepare)
    [[ $# -eq 1 || $# -eq 2 ]] || die "Invalid prepare arguments."
    staging_name=$1
    readonly RECOVERY_MODE="${2:-automatic}"
    validate_recovery_mode "$RECOVERY_MODE"

    assert_target_context
    validate_staging_name "$staging_name"
    umask 077
    mkdir -- "$staging_name" || die "Could not create remote staging directory."
    if [[ "$RECOVERY_MODE" == "manual" ]]; then
      printf 'manual:v1\n' > "$staging_name/manual-recovery"
    fi
    log "Remote staging directory created."
    ;;

  cleanup)
    [[ $# -eq 1 ]] || die "Invalid cleanup arguments."
    staging_name=$1

    assert_target_context
    remove_staging_directory "$staging_name"
    ;;

  deploy)
    [[ $# -eq 5 || $# -eq 6 ]] || die "Invalid deploy arguments."
    readonly RECOVERY_MODE="${6:-automatic}"
    validate_recovery_mode "$RECOVERY_MODE"
    staging_name=$1
    release_id=$2
    retention=$3
    retries=$4
    delay=$5
    backup_name=".output-deploy-backup-$release_id"
    archive_path="$staging_name/release.tar.gz"
    extracted_path="$staging_name/extracted"
    deployment_confirmed=0

    assert_target_context
    configure_runtime_tools
    require_command pm2
    require_command curl
    require_command tar
    validate_pm2_app
    validate_pm2_runtime_environment
    validate_staging_name "$staging_name"
    validate_release_id "$release_id"
    validate_backup_name "$backup_name"
    validate_positive_integer "$retention" "Backup retention" 50
    validate_positive_integer "$retries" "Health retries" 60
    validate_positive_integer "$delay" "Health delay" 30
    [[ -d "$staging_name" && ! -L "$staging_name" ]] || die "Remote staging directory is missing or unsafe."
    if [[ "$RECOVERY_MODE" == "manual" ]]; then
      [[ -f "$staging_name/manual-recovery" && ! -L "$staging_name/manual-recovery" ]] \
        && [[ "$(cat "$staging_name/manual-recovery")" == "manual:v1" ]] \
        || die "Manual-recovery staging marker was not verified."
    else
      [[ ! -e "$staging_name/manual-recovery" ]] || die "Cannot activate manual-recovery staging in automatic mode."
    fi
    [[ -d .output && ! -L .output ]] || die "Current .output directory is missing or unsafe."
    [[ -f .output/server/index.mjs ]] || die "Current production entry point is missing."
    [[ ! -e "$backup_name" && ! -L "$backup_name" ]] || die "Backup name already exists."

    trap handle_deploy_exit EXIT
    trap handle_deploy_error ERR
    trap 'handle_deploy_signal 130' INT
    trap 'handle_deploy_signal 143' TERM
    trap 'handle_deploy_signal 129' HUP

    phase="extract"
    log "Validating uploaded archive."
    validate_archive "$archive_path"
    mkdir -- "$extracted_path"
    tar -xzf "$archive_path" -C "$extracted_path" --no-same-owner --no-same-permissions
    [[ -f "$extracted_path/.output/server/index.mjs" ]] \
      || die "New release entry point is missing."

    phase="pre-activation"
    if [[ "$RECOVERY_MODE" == "manual" ]]; then
      record_remote_evidence pending || die "Required manual-recovery hashes could not be recorded."
    fi

    phase="backup"
    log "Backing up current .output to $backup_name"
    mv -- .output "$backup_name"

    phase="activation"
    log "Activating new .output."
    mv -- "$extracted_path/.output" .output

    phase="restart"
    log "Restarting existing PM2 application: $PM2_APP"
    restart_log="/dev/null"
    if [[ "$RECOVERY_MODE" == "manual" ]]; then
      umask 077
      restart_log="$staging_name/pm2-restart.log"
    fi
    if ! pm2 restart "$PM2_APP" >"$restart_log" 2>&1; then
      rollback_during_deploy "$backup_name" "$staging_name" "$retries" "$delay"
    fi

    phase="remote-health"
    log "Checking application at $HEALTHCHECK_URL"
    if ! wait_for_health "$retries" "$delay"; then
      rollback_during_deploy "$backup_name" "$staging_name" "$retries" "$delay"
    fi

    deployment_confirmed=1
    phase="server-healthy"
    if [[ "$RECOVERY_MODE" == "manual" ]]; then
      record_remote_evidence 0 || die "Could not record manual-recovery completion evidence."
    fi
    trap - EXIT ERR INT TERM HUP
    if [[ "$RECOVERY_MODE" == "manual" ]]; then
      log "Manual recovery verified: staging, archive, hashes, restart diagnostics and all backups retained."
    else
      remove_staging_directory "$staging_name" || warn "Could not remove the successful deployment staging directory."
      cleanup_old_backups "$retention"
    fi
    log "Server health check passed."
    ;;

  rollback)
    [[ $# -eq 4 ]] || die "Invalid rollback arguments."
    backup_name=$1
    release_id=$2
    retries=$3
    delay=$4
    failed_name=".output-deploy-failed-$release_id"

    assert_target_context
    configure_runtime_tools
    require_command pm2
    require_command curl
    validate_pm2_app
    validate_backup_name "$backup_name"
    validate_release_id "$release_id"
    [[ ! -e ".deploy-staging-$release_id/manual-recovery" ]] \
      || die "This release requires separately reviewed manual recovery; automatic rollback is forbidden."
    validate_positive_integer "$retries" "Health retries" 60
    validate_positive_integer "$delay" "Health delay" 30
    [[ "$failed_name" =~ ^\.output-deploy-failed-[0-9]{8}-[0-9]{6}-[0-9]+$ ]] \
      || die "Unsafe failed-release name."
    [[ -d "$backup_name" && ! -L "$backup_name" ]] \
      || die "Rollback backup is missing: $backup_name"
    [[ -d .output && ! -L .output ]] \
      || die "Current .output directory is missing or unsafe."
    [[ ! -e "$failed_name" && ! -L "$failed_name" ]] \
      || die "Failed-release path already exists."

    mv -- .output "$failed_name"
    if ! mv -- "$backup_name" .output; then
      mv -- "$failed_name" .output || true
      die "Could not restore the rollback backup."
    fi

    if ! restart_and_check "$retries" "$delay"; then
      warn "Previous release was restored, but its health check failed."
      exit 2
    fi

    rm -rf -- "$failed_name"
    log "Previous release restored and verified."
    ;;

  *)
    die "Unknown remote deployment command."
    ;;
esac
