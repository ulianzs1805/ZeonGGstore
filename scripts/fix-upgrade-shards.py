# Applied by the repository workflow to keep the upgrade animation as one coherent PNG shattering into pieces.
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
    x: (next(id * 9 + 1) - 0.5) * 190,
    y: (next(id * 9 + 2) - 0.5) * 165,
    rotate: (next(id * 9 + 3) - 0.5) * 190,
    delay: Math.round(next(id * 9 + 4) * 120),
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
  const fromBase = side === "left" ? "calc(11% - 90px)" : "calc(89% - 90px)";
  const toBase = "calc(11% - 90px)";
  const tileW = 100 / cols;
  const tileH = 100 / rows;
  const pieces = Array.from({ length: cols * rows }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x0 = col * tileW;
    const x1 = (col + 1) * tileW;
    const y0 = row * tileH;
    const y1 = (row + 1) * tileH;
    const inset = 2.1;
    const clip = `polygon(${x0 + inset}% ${y0 + inset}%,${x1 - inset}% ${y0 + 1.2}%,${x1 - .8}% ${y1 - inset}%,${x0 + 1.4}% ${y1 - 1.1}%)`;
    return { index, col, row, clip, particle: particles[index % particles.length] };
  });

  return <div className="absolute" style={{ left: fromBase, top: "calc(50% - 40px)", width: "180px", height: "80px" }}>
    {pieces.map(({ index, col, row, clip, particle }) => {
      const horizontal = side === "left" ? -1 : 1;
      const burstX = horizontal * (115 + Math.abs(particle.x) * 1.05) + (col - 1.5) * 12;
      const burstY = particle.y * 1.08 + (row - 2) * 10;
      const style: CSSProperties & Record<string, string> = {
        left: "0px",
        top: "0px",
        width: "180px",
        height: "80px",
        backgroundImage: `url("${safeImage}")`,
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        clipPath: clip,
        animationDelay: `${phase === "gather" ? particle.delay : index * 10}ms`,
        "--burst-x": `${burstX}px`,
        "--burst-y": `${burstY}px`,
        "--r": `${particle.rotate}deg`,
        "--from-x": side === "left" ? "0px" : "calc(78% - 180px)",
        "--to-x": side === "right" && phase === "gather" ? "calc(-78% + 180px)" : "0px",
      };

      return <span key={`${item.id}-${side}-${phase}-${index}`} className={`upgrade-shard ${phase === "gather" ? "upgrade-shard-gather" : "upgrade-shard-burst"}`} style={style} />;
    })}<style jsx>{`
      .upgrade-shard{position:absolute;display:block;will-change:transform,opacity,filter;opacity:0;transform-origin:50% 50%;filter:drop-shadow(0 0 8px rgba(124,58,237,.35))}
      .upgrade-shard-burst{animation:upgradeShardBurst ${BURST_MS}ms cubic-bezier(.08,.78,.12,1) forwards}
      .upgrade-shard-gather{animation:upgradeShardGather ${GATHER_MS}ms cubic-bezier(.12,.78,.16,1) forwards}
      @keyframes upgradeShardBurst{
        0%{opacity:0;transform:translate(0,0) rotate(0deg) scale(.98);filter:brightness(1.02) saturate(1.02) drop-shadow(0 0 8px rgba(124,58,237,.25))}
        4%{opacity:1;transform:translate(0,0) rotate(0deg) scale(1.02);filter:brightness(1.9) saturate(1.3) drop-shadow(0 0 16px rgba(196,181,253,.65))}
        13%{opacity:1;transform:translate(0,0) rotate(0deg) scale(1)}
        100%{opacity:0;transform:translate(var(--burst-x),var(--burst-y)) rotate(var(--r)) scale(.42);filter:brightness(.72) saturate(.88) drop-shadow(0 0 3px rgba(124,58,237,.12))}
      }
      @keyframes upgradeShardGather{
        0%{opacity:0;transform:translate(calc(var(--to-x) + var(--burst-x)),var(--burst-y)) rotate(var(--r)) scale(.38);filter:brightness(1.45) saturate(1.2) drop-shadow(0 0 14px rgba(196,181,253,.6))}
        10%{opacity:1;transform:translate(calc(var(--to-x) + var(--burst-x) * .72),calc(var(--burst-y) * .72)) rotate(calc(var(--r) * .72)) scale(.56)}
        66%{opacity:1;filter:brightness(1.18) saturate(1.08)}
        100%{opacity:1;transform:translate(var(--to-x),0) rotate(0deg) scale(1);filter:brightness(1.03) saturate(1.03) drop-shadow(0 0 8px rgba(124,58,237,.18))}
      }
    `}</style>
  </div>;
}

'''

s = s[:start] + replacement + s[end:]
p.write_text(s)
print('coherent single-image shatter fixed')
