from pathlib import Path
import re

p = Path('src/app/upgrade/page.tsx')
s = p.read_text()

# This fix deliberately has no cross-screen movement. On a win the new shard pack is
# rendered directly inside the LEFT WeaponSlot, then gathers there.
particles_re = re.compile(r'function makeParticles\(seed: number\): Particle\[\] \{.*?\n\}', re.S)
particles_new = '''function makeParticles(seed: number): Particle[] {
  const next = (n: number) => {
    const x = Math.sin(n * 981.73 + seed * 0.00021) * 10000;
    return x - Math.floor(x);
  };
  return Array.from({ length: 20 }, (_, id) => {
    const angle = next(id * 9 + 1) * Math.PI * 2;
    const radius = 110 + next(id * 9 + 2) * 165;
    return {
      id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      rotate: (next(id * 9 + 3) - 0.5) * 220,
      delay: Math.round(next(id * 9 + 4) * 110),
    };
  });
}'''
s, count = particles_re.subn(particles_new, s, count=1)
if count != 1:
    raise SystemExit('makeParticles block not found')

# Remove any old global fragment layer if it still exists.
s = re.sub(r'<UpgradeFragmentLayer[^>]*/>\s*', '', s)

# Replace the LEFT slot opening tag as a whole. This prevents old duplicate props from
# surviving earlier automated fixes.
left_tag = '''<WeaponSlot item={displayInput} side="left" onShuffle={() => { setOptimisticInput(null); setInputId(""); }} imageHidden={animating} fragmentItem={phase === "burst" ? leftFragments : phase === "gather" ? winningItem : null} fragmentMode={phase === "burst" ? "burst" : phase === "gather" ? "gather" : null} particles={particles} />'''
left_pattern = re.compile(r'<WeaponSlot item=\{displayInput\} side="left".*?\s*/>', re.S)
s, count = left_pattern.subn(left_tag, s, count=1)
if count != 1:
    raise SystemExit('left WeaponSlot opening tag not found')

# Replace the RIGHT slot opening tag as a whole too.
right_tag = '''<WeaponSlot item={displayTarget} side="right" onShuffle={() => setTargetId("")} imageHidden={animating} fragmentItem={phase === "burst" ? rightFragments : null} fragmentMode={phase === "burst" ? "burst" : null} particles={particles} />'''
right_pattern = re.compile(r'<WeaponSlot item=\{displayTarget\} side="right".*?\s*/>', re.S)
s, count = right_pattern.subn(right_tag, s, count=1)
if count != 1:
    raise SystemExit('right WeaponSlot opening tag not found')

# Gather must not carry any right-to-left offset. The pack is born inside the left slot.
s = re.sub(
    r'@keyframes upgradeShardGather\{.*?\}',
    '@keyframes upgradeShardGather{0%{opacity:0;transform:translate(calc(var(--burst-x) * .22),calc(var(--burst-y) * .22)) rotate(var(--r)) scale(.34);filter:brightness(1.7) saturate(1.28) drop-shadow(0 0 15px rgba(196,181,253,.62))}12%{opacity:1;transform:translate(calc(var(--burst-x) * .15),calc(var(--burst-y) * .15)) rotate(calc(var(--r) * .62)) scale(.58)}70%{opacity:1;filter:brightness(1.2) saturate(1.1)}100%{opacity:0;transform:translate(0,0) rotate(0deg) scale(1);filter:brightness(1.03) saturate(1.03)}}',
    s,
    count=1,
    flags=re.S,
)

p.write_text(s)
print('OK: win shards now spawn and gather directly inside the left slot; duplicate props removed')
