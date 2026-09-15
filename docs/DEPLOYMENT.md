# Deployment

Run one command to build, upload, activate, and verify the site:

```bash
npm run deploy
```

The script only deploys `.output`. It never uploads `.env`, source files, Git data, or local `node_modules`.

## First-time setup

Copy the deployment settings template:

```bash
cp .deploy.env.example .deploy.env
```

Set `DEPLOY_HOST` to the VPS hostname, IP address, or SSH alias:

```dotenv
DEPLOY_HOST=your-ssh-host-or-alias
DEPLOY_PORT=22
```

`.deploy.env` is ignored by Git. It should contain deployment settings only, never application secrets.

The following safety targets are read-only constants in both deployment scripts:

```text
SSH user:       newelcomputer
Site directory: /home/newelcomputer/htdocs/new.elcomputer.net
PM2 process:    new-elcomputer
PM2 mode:       fork_mode
PM2 entry:      /home/newelcomputer/htdocs/new.elcomputer.net/.output/server/index.mjs
Node runtime:   /home/newelcomputer/.nvm/versions/node/v22.23.1/bin
Local health:   http://127.0.0.1:3001/
Public health:  https://new.elcomputer.net/
```

`.deploy.env` cannot override these values. The deployment aborts if it contains an attempted override.

Test the configuration without building or deploying:

```bash
npm run deploy:check
```

Preflight also confirms that the existing PM2 process has Supabase URL, public key, and the server-only `NUXT_SUPABASE_SERVICE_ROLE_KEY` runtime variable. It checks variable names and non-empty values without printing any secrets.

The release is built without local credentials. Production application settings must therefore already exist in the PM2 process environment. The service-role secret must use `NUXT_SUPABASE_SERVICE_ROLE_KEY`; `SUPABASE_SERVICE_ROLE_KEY` alone is only read while evaluating the build configuration. Add or change settings through CloudPanel, your PM2 ecosystem configuration, or another server-side secret store before deployment.

Nuxt may print missing-Supabase warnings during the secret-free build. This is expected; preflight has already verified that PM2 will supply those values at runtime.

Preflight allows the old release up to 30 seconds to respond. New and restored releases use the stricter deployment retry checks.

## SSH access

The deployment requires SSH-key authentication. It does not accept or store passwords.

Create a key if needed:

```bash
ssh-keygen -t ed25519 -C "new.elcomputer.net deployment"
ssh-copy-id -p 22 newelcomputer@YOUR_SERVER
```

Test it:

```bash
ssh -p 22 newelcomputer@YOUR_SERVER
```

You may use a host from `~/.ssh/config` as `DEPLOY_HOST`. Set `DEPLOY_IDENTITY_FILE` only when SSH cannot select the correct key itself. Never copy a private key into this repository.

## What happens during deployment

The deployment performs these steps:

1. Validates local tools and deployment settings.
2. Verifies `whoami`, the exact resolved directory, and the existing PM2 application.
3. Builds Nuxt without loading the local `.env`.
4. Checks that `.output/server/index.mjs` exists.
5. Scans the output for local secret values.
6. Packages only `.output` into a temporary archive.
7. Uploads it into a unique directory below the configured site.
8. Validates and extracts the archive.
9. Renames the current `.output` to a timestamped backup.
10. Activates the new `.output` and restarts the existing PM2 app.
11. Checks the local Node endpoint and public HTTPS website.
12. Removes temporary files and retains the newest five script-created backups.

The script does not use `pm2 --update-env`. Existing PM2 environment variables and server secrets remain unchanged.

It never uses `sudo`, `systemctl`, global PM2 commands, nginx commands, CloudPanel commands, firewall commands, or server-wide environment changes.

## Normal deployment

Test locally, then run:

```bash
npm run deploy
```

Backups are stored beside `.output`:

```text
/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-YYYYMMDD-HHMMSS-PID
```

Only backups beginning with `.output-deploy-backup-` are included in automatic retention. Existing `.output-backup-*`, `.output-old*`, and other historical folders are untouched.

## Status and logs

On the VPS:

```bash
pm2 status
pm2 describe new-elcomputer
pm2 logs new-elcomputer --lines 50
```

## Automatic rollback

If PM2 restart or the internal HTTP check fails, the remote helper restores the backup, restarts PM2, and verifies the restored version.

If the public HTTPS check fails, the local script requests the same rollback. A failed deployment exits with a non-zero status and reports whether rollback succeeded.

## Manual rollback

Log in as `newelcomputer`, enter the site directory, and select a script-created backup:

```bash
cd /home/newelcomputer/htdocs/new.elcomputer.net
ls -1dt .output-deploy-backup-*
```

Then stop the app, preserve the failed release, restore the chosen backup, and start the existing process:

```bash
pm2 stop new-elcomputer
mv .output ".output-manual-failed-$(date +%Y%m%d-%H%M%S)"
mv .output-deploy-backup-YYYYMMDD-HHMMSS-PID .output
pm2 restart new-elcomputer
curl -fsS http://127.0.0.1:3001/ >/dev/null
```

Do not use `--update-env` unless you intentionally changed the PM2 environment.
