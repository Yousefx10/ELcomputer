#!/usr/bin/env python3
"""Build an offline, public-input deployment kit. No credentials or customer data."""
import argparse
import hashlib
import importlib.util
import json
import pathlib
import shutil
import subprocess


def main():
    a = argparse.ArgumentParser()
    for name in ['config', 'mapping', 'candidate', 'recovery', 'tools', 'output']:
        a.add_argument('--' + name, required=True)
    args = a.parse_args(); here = pathlib.Path(__file__).resolve().parent
    repo = here.parent.parent; candidate, recovery, tools = map(pathlib.Path, [args.candidate, args.recovery, args.tools])
    cfg = json.loads(pathlib.Path(args.config).read_text()); release = json.loads((candidate / 'release.json').read_text())
    assert release['source']['commit'] == cfg['application_commit']
    assert release['archive']['sha256'] == cfg['application_archive_sha256']
    subprocess.run(['git', '-C', str(repo), 'merge-base', '--is-ancestor', cfg['application_commit'], 'HEAD'], check=True)
    inputs = json.loads((candidate / 'application-inputs.json').read_text())
    for name, digest in inputs.items():
        assert hashlib.sha256((repo / name).read_bytes()).hexdigest() == digest, 'Application changed; reseal before packaging'
    assert hashlib.sha256((candidate / 'release.tar.gz').read_bytes()).hexdigest() == cfg['application_archive_sha256']
    assert hashlib.sha256((candidate / 'application-inputs.json').read_bytes()).hexdigest() == cfg['application_inputs_sha256']
    module = importlib.util.spec_from_file_location('render', here / 'render.py'); render = importlib.util.module_from_spec(module); module.loader.exec_module(render)
    mapping = json.loads(pathlib.Path(args.mapping).read_text()); render.validate(cfg, mapping)
    output = pathlib.Path(args.output); output.mkdir(mode=0o700)
    copy = [(pathlib.Path(args.config), 'config.json'), (pathlib.Path(args.mapping), 'legacy-urls.json'),
            (candidate / 'release.tar.gz', 'release.tar.gz'), (candidate / 'output-inventory.json', 'output-inventory.json'),
            (candidate / 'application-inputs.json', 'application-inputs.json'), (candidate / 'release.json', 'release.json'),
            (recovery / 'media-manifest.json', 'media-manifest.json'),
            (tools / f"node-v{cfg['node_version']}-linux-x64.tar.xz", f"node-v{cfg['node_version']}-linux-x64.tar.xz"),
            (tools / f"caddy_{cfg['caddy_version']}_linux_amd64.tar.gz", f"caddy_{cfg['caddy_version']}_linux_amd64.tar.gz")]
    copy += [(here / name, name) for name in ['install.py', 'deploy.py', 'restore-media.py', 'restore-env.py', 'health.py', 'rehearse-linux.sh', 'lab.py']]
    for source, name in copy: shutil.copyfile(source, output / name)
    (output / 'Caddyfile').write_text(render.render(cfg, mapping))
    (output / 'maintenance.Caddyfile').write_text('''{
    admin off
}
''' + cfg['domain'] + ', ' + cfg['alias'] + ''' {
    header Retry-After 1800
    respond "Maintenance" 503
}
http:// {
    respond "Unknown site" 421
}
''')
    app, caddy = render.units(cfg)
    (output / (cfg['service'] + '.service')).write_text(app); (output / 'caddy.service').write_text(caddy)
    sums = {str(f.relative_to(output)): hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(output.iterdir())}
    (output / 'SHA256.json').write_text(json.dumps(sums, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'result': 'PASS', 'application_inputs': len(inputs), 'kit_files': len(sums) + 1, 'secrets': 0}))


if __name__ == '__main__': main()
