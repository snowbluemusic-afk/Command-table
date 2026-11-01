#!/usr/bin/env python3
"""Make a complete OFFLINE Forge resource payload from the exact pinned Forge checkout.

Upstream Android builds release an assets.zip separately. Command Table embeds it
in the APK, preserving Forge's res/ layout including the cardsfolder.zip index.
No post-install download/setup is required.
"""
import os
import sys
import zipfile
from pathlib import Path

forge = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
root = forge / 'forge-gui' / 'res'
cards = root / 'cardsfolder'
assert root.is_dir() and cards.is_dir(), 'Forge card resource directory missing'
output.parent.mkdir(parents=True, exist_ok=True)
internal_card_zip = output.with_suffix('.cards.tmp.zip')
card_count = 0

with zipfile.ZipFile(internal_card_zip, 'w', compression=zipfile.ZIP_DEFLATED,
                     compresslevel=1, allowZip64=True) as inner:
    for p in sorted(cards.rglob('*')):
        if not p.is_file() or p.suffix.lower() in ('.xcf', '.bak'):
            continue
        inner.write(p, p.relative_to(cards).as_posix())
        card_count += 1
assert card_count >= 1000, f'Incomplete Forge card scripts: {card_count}'

file_count = 0
try:
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED,
                         compresslevel=1, allowZip64=True) as packed:
        for p in sorted(root.rglob('*')):
            if not p.is_file() or cards in p.parents or p.suffix.lower() == '.xcf':
                continue
            packed.write(p, 'res/' + p.relative_to(root).as_posix())
            file_count += 1
        packed.write(internal_card_zip, 'res/cardsfolder/cardsfolder.zip',
                     compress_type=zipfile.ZIP_STORED)
        file_count += 1
finally:
    internal_card_zip.unlink(missing_ok=True)
assert file_count > 100, f'Incomplete Forge resource pack: {file_count}'
assert output.stat().st_size > 5_000_000, 'Unexpectedly small resource bundle'
print(f'Offline Forge bundle: {card_count} card scripts, {file_count} resource files, '
      f'{output.stat().st_size / 1024 / 1024:.1f} MiB')
