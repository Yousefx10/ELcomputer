"""Owner-only encrypted configuration export. Never changes source configuration.

Run only after approval of an exact deployment-specific JSON and its SHA-256.
Usage: python3 -I -B protected-backup-export.py CONFIG EXPECTED_CONFIG_SHA256
Only the public recipient certificate belongs in CONFIG. Never supply a private key.
"""
import base64
import hashlib
import json
import os
import pathlib
import pwd
import shutil
import subprocess
import sys

state = {'phase': 'owner_root_requirement'}

def main():
    if os.geteuid() != 0:
        raise RuntimeError('OWNER_ROOT_REQUIRED')
    state['phase'] = 'configuration_binding'
    config_file, expected = sys.argv[1:]
    raw = pathlib.Path(config_file).read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected:
        raise RuntimeError('CONFIG_BINDING_CHANGED')
    config = json.loads(raw)
    assert config['format'] == 1
    state['phase'] = 'host_and_account_binding'
    account = pwd.getpwnam(config['export_user'])
    assert (account.pw_uid, account.pw_gid) == (config['export_uid'], config['export_gid'])
    public = pathlib.Path('/etc/ssh/ssh_host_ed25519_key.pub').read_text().split()
    fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(base64.b64decode(public[1])).digest()).decode().rstrip('=')
    assert fingerprint == config['host_ed25519_fingerprint']
    state['phase'] = 'required_path_inventory'
    paths = []
    for name in config['required_paths']:
        path = pathlib.Path(name)
        assert path.is_absolute() and '..' not in path.parts
        path.lstat()  # Missing required data stops before backup creation.
        paths.append(name)
    for name in config['optional_paths']:
        path = pathlib.Path(name)
        assert path.is_absolute() and '..' not in path.parts
        if path.exists() or path.is_symlink():
            paths.append(name)
    state['phase'] = 'exclusive_backup_directory'
    private = pathlib.Path(config['root_backup_directory'])
    assert private.parent == pathlib.Path('/root')
    os.umask(0o077)
    os.mkdir(private, 0o700)  # Exclusive. Never retry into a consumed directory.
    state['phase'] = 'recipient_binding'
    certificate = private / 'recipient.pem'
    certificate.write_text(config['recipient_certificate_pem'])
    certificate.chmod(0o600)
    assert hashlib.sha256(certificate.read_bytes()).hexdigest() == config['recipient_certificate_sha256']
    archive = private / 'protected-config.cms'
    fd = os.open(archive, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    state['phase'] = 'encrypted_export'
    try:
        tar = subprocess.Popen(['/usr/bin/nice', '-n', '15', '/usr/bin/tar', '--acls', '--xattrs', '--numeric-owner', '-C', '/', '-cf', '-'] + [p.lstrip('/') for p in paths], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        # OpenSSL generates the content key internally. The VPS receives no private
        # recipient key, database credential or plaintext archive file.
        encrypted = subprocess.Popen(['/usr/bin/openssl', 'cms', '-encrypt', '-aes-256-gcm', '-binary', '-outform', 'DER', '-stream', '-recip', str(certificate)], stdin=tar.stdout, stdout=fd, stderr=subprocess.PIPE)
        tar.stdout.close()
        _, crypto_error = encrypted.communicate()
        tar_error = tar.stderr.read()
        tar.wait()
        state.update(tar_exit_code=tar.returncode, encryption_exit_code=encrypted.returncode)
        if tar.returncode or encrypted.returncode:
            raise RuntimeError('EXPORT_FAILED_PRESERVE_ARTIFACT')
        os.fsync(fd)
    finally:
        os.close(fd)
    state['phase'] = 'ciphertext_integrity'
    h = hashlib.sha256()
    with archive.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    receipt = {'result': 'EXPORT_CREATED_OFFVPS_VERIFICATION_PENDING', 'config_sha256': expected,
               'host_ed25519_fingerprint': fingerprint, 'encrypted_bytes': archive.stat().st_size,
               'encrypted_sha256': h.hexdigest(), 'paths': paths,
               'source_configuration_changed': False, 'services_changed': False,
               'database_connected': False, 'private_recipient_key_on_vps': False}
    (private / 'RECEIPT.json').write_text(json.dumps(receipt, indent=2) + '\n')
    # Transfer ciphertext through held directory descriptors, without following
    # account-controlled destination links or overwriting an existing export.
    state['phase'] = 'exclusive_ciphertext_retrieval_copy'
    home = pathlib.Path(account.pw_dir)
    assert home.resolve(strict=True) == home
    home_fd = os.open(home, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    directory_fd = None
    try:
        export_name = config['export_directory_name']
        assert '/' not in export_name and export_name not in ['', '.', '..']
        os.mkdir(export_name, 0o700, dir_fd=home_fd)
        directory_fd = os.open(export_name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=home_fd)
        for source in [archive, private / 'RECEIPT.json']:
            target_fd = os.open(source.name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=directory_fd)
            with os.fdopen(target_fd, 'wb') as target, source.open('rb') as original:
                shutil.copyfileobj(original, target, 1024 * 1024)
                target.flush()
                os.fchown(target.fileno(), account.pw_uid, account.pw_gid)
                os.fsync(target.fileno())
        os.fsync(directory_fd)
        os.fchown(directory_fd, account.pw_uid, account.pw_gid)
        os.fsync(home_fd)
    finally:
        if directory_fd is not None:
            os.close(directory_fd)
        os.close(home_fd)
    receipt['encrypted_retrieval_directory'] = str(home / config['export_directory_name'])
    print(json.dumps(receipt))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Do not print SQL, configuration, paths from exceptions or subprocess logs.
        print(json.dumps({'result': 'BLOCKED', **state, 'error_type': type(error).__name__,
                          'preserve_artifacts': True, 'automatic_retry_permitted': False}))
        raise SystemExit(1)
