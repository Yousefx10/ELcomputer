"""Read-only inventory; send config as JSON on stdin and encrypt stdout locally.

Config: {"roots": [{"label": "...", "path": "/absolute/path"}], "hash": true}.
Never follows symlinks or loads application configuration as executable code.
"""
import datetime
import hashlib
import json
import os
import pathlib
import stat
import sys

config = json.load(sys.stdin)
result = {"observed_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "uid": os.getuid(), "roots": [], "production_writes": 0}
for root in config["roots"]:
    path = pathlib.Path(root["path"])
    assert path.is_absolute() and ".." not in path.parts
    item = {"label": root["label"], "path": str(path), "entries": [], "errors": []}
    result["roots"].append(item)

    def visit(p):
        try:
            before = p.lstat()
            entry = {"path": str(p.relative_to(path)) if p != path else ".",
                     "mode": stat.S_IMODE(before.st_mode), "uid": before.st_uid,
                     "gid": before.st_gid, "bytes": before.st_size,
                     "mtime_ns": before.st_mtime_ns, "inode": before.st_ino,
                     "device": before.st_dev, "nlink": before.st_nlink}
            if stat.S_ISLNK(before.st_mode):
                entry.update(kind="symlink", target=os.readlink(p))
            elif stat.S_ISDIR(before.st_mode):
                entry["kind"] = "directory"
            elif stat.S_ISREG(before.st_mode):
                entry["kind"] = "file"
                if config.get("hash", True):
                    h = hashlib.sha256()
                    fd = os.open(p, os.O_RDONLY | os.O_NOFOLLOW)
                    with os.fdopen(fd, "rb") as stream:
                        opened = os.fstat(stream.fileno())
                        assert (opened.st_dev, opened.st_ino) == (before.st_dev, before.st_ino)
                        for block in iter(lambda: stream.read(1024 * 1024), b""):
                            h.update(block)
                        after = os.fstat(stream.fileno())
                    assert (before.st_size, before.st_mtime_ns, before.st_ctime_ns) == (after.st_size, after.st_mtime_ns, after.st_ctime_ns)
                    entry["sha256"] = h.hexdigest()
            else:
                entry["kind"] = "special"
            item["entries"].append(entry)
            if entry["kind"] == "directory":
                for child in sorted(p.iterdir()):
                    visit(child)
        except (OSError, AssertionError) as error:
            item["errors"].append({"path": str(p), "error_type": type(error).__name__})

    visit(path)
json.dump(result, sys.stdout, separators=(",", ":"))
sys.stdout.write("\n")
