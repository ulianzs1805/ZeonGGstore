from pathlib import Path

# Anchoring is now handled directly inside the real shard renderer.
# Keep this workflow step as a no-op so it cannot overwrite the exact image-box coordinates.
p = Path('src/app/upgrade/page.tsx')
if not p.exists():
    raise SystemExit('upgrade page not found')
print('inline shard anchors are already exact')
