from pathlib import Path
import re

p = Path('src/app/upgrade/page.tsx')
s = p.read_text()

particles_re = re.compile(r'function makeParticles\(seed: number\): Particle\[\] \{.*?\n\}', re.S)
particles_new = '''function makeParticles(seed: number): Particle[] {
  const next = (n: number) => {
    const x = Math.sin(n * 981.73 + seed * 0.00021) * 10000;
    return x - Math.floor(x);
  };

  return Array.from({ length: 20 }, (_, id) => ({
    id,
    x: (next(id * 9 + 1) - 0.5) * 170,
    y: (next(id * 9 + 2) - 0.5) * 145,
    rotate: (next(id * 9 + 3) - 0.5) * 150,
    delay: Math.round(next(id * 9 + 4) * 150),
  }));
}'''
s, count = particles_re.subn(particles_new, s, count=1)
if count != 1:
    raise SystemExit('makeParticles block not found')

start = s.index('function UpgradeFragmentLayer(')
end = s.index('function WeaponSlot(', start)

replacement = '''function UpgradeFragmentLayer({ leftItem, rightItem, winningItem, phase, particles }: { leftItem: Item | null; rightItem: Item | null; winningItem: Item | null; phase: Phase; particles: Particle[] }) {
  if (phase === "idle" || particles.length === 0) return null;

  return <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
    {leftItem && <ShardPack item={leftItem} side="left" phase="burst" particles={particles} />}
    {rightItem && phase === "burst" && <ShardPack item={rightItem} side="right" phase="burst" particles={particles} />}
    {winningItem && phase === "gather" && <ShardPack item={winningItem} side="right" phase="gather" particles={particles} />}
  </div>;
}

function ShardPack({ item, side, phase, particles }: { item: Item; side: "left" | "right"; phase: "burst" | "gather"; particles: Particle[] }) {
  const safeImage = item.image.replace(/"/g, "%22");
  const cols = 4;
  const rows = 5;
  const pieces = Array.from({ length: cols * rows }, (_, index) => ({
    index,
    col: index % cols,
    row: Math.floor(index / cols),
    particle: particles[index % particles.length],
  }));

  const fromBase = side === "left" ? "calc(11% - 76px)" : "calc(89% - 76px)";
  const toBase = "calc(11% - 76px)";
  const clipShapes = [
    "polygon(6% 8%,90% 0%,100% 76%,74% 100%,0% 88%)",
    "polygon(0% 14%,78% 0%,100% 28%,92% 100%,8% 86%)",
    "polygon(10% 0%,100% 10%,88% 92%,18% 100%,0% 56%)",
    "polygon(0% 0%,88% 12%,100% 66%,72% 100%,4% 82%)",
  ];

  return <>{pieces.map(({ index, col, row, particle }) => {
    const horizontal = side === "left" ? -1 : 1;
    const baseX = 132 + Math.abs(particle.x) * 1.2;
    const burstX = horizontal * baseX + (col - 1.5) * 18;
    const burstY = particle.y * 1.18 + (row - 2) * 14;
    const style: CSSProperties & Record<string, string> = {
      left: `calc(${fromBase} + ${col * 38}px)`,
      top: `calc(50% - 45px + ${row * 18}px)`,
      width: "38px",
      height: "18px",
      backgroundImage: `url("${safeImage}")`,
      backgroundSize: "400% 500%",
      backgroundPosition: `${(col / (cols - 1)) * 100}% ${(row / (rows - 1)) * 100}%`,
      backgroundRepeat: "no-repeat",
      clipPath: clipShapes[index % clipShapes.length],
      animationDelay: `${phase === "gather" ? particle.delay : index * 12}ms`,
      "--burst-x": `${burstX}px`,
      "--burst-y": `${burstY}px`,
      "--r": `${particle.rotate}deg`,
      "--from-left": `calc(${fromBase} + ${col * 38}px)`,
      "--to-left": `calc(${toBase} + ${col * 38}px)`,
      "--from-top": `calc(50% - 45px + ${row * 18}px)`,
      "--to-top": `calc(50% - 45px + ${row * 18}px)`,
    };

    return <span key={`${item.id}-${side}-${phase}-${index}`} className={`upgrade-shard ${phase === "gather" ? "upgrade-shard-gather" : "upgrade-shard-burst"}`} style={style} />;
  })}<style jsx>{`
    .upgrade-shard{position:absolute;display:block;border:1px solid rgba(255,255,255,.14);box-shadow:0 0 9px rgba(255,255,255,.12),0 0 20px rgba(124,58,237,.34);will-change:left,top,transform,opacity,filter;opacity:0;transform-origin:50% 50%}
    .upgrade-shard-burst{animation:upgradeShardBurst ${BURST_MS}ms cubic-bezier(.08,.8,.12,1) forwards}
    .upgrade-shard-gather{animation:upgradeShardGather ${GATHER_MS}ms cubic-bezier(.14,.78,.18,1) forwards}
    @keyframes upgradeShardBurst{
      0%{opacity:0;transform:translate(0,0) rotate(0deg) scale(.7);filter:brightness(1.05) saturate(1.05)}
      5%{opacity:1;transform:translate(0,0) rotate(0deg) scale(1.16);filter:brightness(2.6) saturate(1.55)}
      12%{opacity:1;transform:translate(0,0) rotate(0deg) scale(.98);filter:brightness(1.5) saturate(1.18)}
      26%{opacity:1;transform:translate(calc(var(--burst-x) * .22),calc(var(--burst-y) * .22)) rotate(calc(var(--r) * .28)) scale(1.04)}
      64%{opacity:.92;filter:brightness(1.04) saturate(1.06)}
      100%{opacity:0;transform:translate(var(--burst-x),var(--burst-y)) rotate(var(--r)) scale(.34);filter:brightness(.76) saturate(.86)}
    }
    @keyframes upgradeShardGather{
      0%{left:var(--from-left);top:var(--from-top);opacity:0;transform:translate(calc(var(--burst-x) * .86),calc(var(--burst-y) * .86)) rotate(var(--r)) scale(.3);filter:brightness(1.55) saturate(1.28)}
      10%{opacity:1;transform:translate(calc(var(--burst-x) * .72),calc(var(--burst-y) * .72)) rotate(calc(var(--r) * .8)) scale(.48)}
      58%{opacity:1;filter:brightness(1.25) saturate(1.12)}
      100%{left:var(--to-left);top:var(--to-top);opacity:1;transform:translate(0,0) rotate(0deg) scale(1);filter:brightness(1.12) saturate(1.05)}
    }
  `}</style></>;
}

'''

s = s[:start] + replacement + s[end:]
p.write_text(s)
print('upgrade shards fixed')
