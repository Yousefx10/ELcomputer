#!/usr/bin/env python3
"""Prepare a private local review directory. This program cannot apply it."""
import argparse
import difflib
import json
from pathlib import Path

from dashboard_access import digest
from product_writes import render_product_writes


def prepare(source_path, binding_path, output):
    # Input must already be an authorized, locally held snapshot. No include
    # expansion, target connection, subprocess, credential or service operation.
    source = Path(source_path).read_text()
    binding = json.loads(Path(binding_path).read_text())
    candidate, receipt = render_product_writes(source, binding)
    files = ('product_writes.py', 'dashboard_access.py', 'config_parser.py', 'dashboard_read_policy.json')
    receipt['renderer_inputs'] = {f: digest(Path(__file__).with_name(f).read_bytes()) for f in files}
    receipt['preparation_program_sha256'] = digest(Path(__file__).read_bytes())
    receipt['binding_sha256'] = digest(Path(binding_path).read_bytes())
    receipt['candidate_bytes'] = len(candidate.encode())
    receipt['limits'] = ['NOT an activation operator', 'Current loaded input and all peer files need attestation',
                        'No production staging, backup, nginx command, reload or application switch performed']
    output = Path(output)
    output.mkdir(mode=0o700)  # Exclusive new directory; never overwrite evidence.
    contents = {
        'accepted.before.conf': source,
        'candidate.conf': candidate,
        'BINDING.json': Path(binding_path).read_text(),
        'change.diff': ''.join(difflib.unified_diff(source.splitlines(True), candidate.splitlines(True),
                                                  fromfile='accepted.before.conf', tofile='candidate.conf')),
        'REVIEW.json': json.dumps(receipt, indent=2, sort_keys=True) + '\n',
    }
    for name, text in contents.items():
        path = output / name
        with path.open('x') as file:
            path.chmod(0o600)
            file.write(text)
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, help='Authorized local accepted-read-policy snapshot')
    parser.add_argument('--binding', required=True, help='Separately reviewed exact-source deployment binding')
    parser.add_argument('--output', required=True, help='New private LOCAL review directory')
    args = parser.parse_args()
    print(json.dumps(prepare(args.source, args.binding, args.output), sort_keys=True))
