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

  for (( attempt = 1; attempt <= retries; attempt++ )); do
    if curl -fsS --max-time 10 -o /dev/null "$HEALTHCHECK_URL"; then
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

  if (( status == 0 )); then
    return 0
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

  if [[ -d "$backup_name" && ! -L "$backup_name" && "$deployment_confirmed" == "0" ]]; then
    rollback_during_deploy "$backup_name" "$staging_name" "$retries" "$delay"
  fi

  exit "$status"
}

handle_deploy_signal() {
  trap - ERR INT TERM HUP

  if [[ -d "$backup_name" && ! -L "$backup_name" && "$deployment_confirmed" == "0" ]]; then
    rollback_during_deploy "$backup_name" "$staging_name" "$retries" "$delay"
  fi

  exit 130
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
    [[ $# -eq 0 ]] || die "Invalid check arguments."

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
    ;;

  prepare)
    [[ $# -eq 1 ]] || die "Invalid prepare arguments."
    staging_name=$1

    assert_target_context
    validate_staging_name "$staging_name"
    umask 077
    mkdir -- "$staging_name" || die "Could not create remote staging directory."
    log "Remote staging directory created."
    ;;

  cleanup)
    [[ $# -eq 1 ]] || die "Invalid cleanup arguments."
    staging_name=$1

    assert_target_context
    remove_staging_directory "$staging_name"
    ;;

  deploy)
    [[ $# -eq 5 ]] || die "Invalid deploy arguments."
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
    [[ -d .output && ! -L .output ]] || die "Current .output directory is missing or unsafe."
    [[ -f .output/server/index.mjs ]] || die "Current production entry point is missing."
    [[ ! -e "$backup_name" && ! -L "$backup_name" ]] || die "Backup name already exists."

    trap handle_deploy_exit EXIT
    trap handle_deploy_error ERR
    trap handle_deploy_signal INT TERM HUP

    log "Validating uploaded archive."
    validate_archive "$archive_path"
    mkdir -- "$extracted_path"
    tar -xzf "$archive_path" -C "$extracted_path" --no-same-owner --no-same-permissions
    [[ -f "$extracted_path/.output/server/index.mjs" ]] \
      || die "New release entry point is missing."

    log "Backing up current .output to $backup_name"
    mv -- .output "$backup_name"

    log "Activating new .output."
    mv -- "$extracted_path/.output" .output

    log "Restarting existing PM2 application: $PM2_APP"
    if ! pm2 restart "$PM2_APP" >/dev/null 2>&1; then
      rollback_during_deploy "$backup_name" "$staging_name" "$retries" "$delay"
    fi

    log "Checking application at $HEALTHCHECK_URL"
    if ! wait_for_health "$retries" "$delay"; then
      rollback_during_deploy "$backup_name" "$staging_name" "$retries" "$delay"
    fi

    deployment_confirmed=1
    trap - EXIT ERR INT TERM HUP
    remove_staging_directory "$staging_name" || warn "Could not remove the successful deployment staging directory."
    cleanup_old_backups "$retention"
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
