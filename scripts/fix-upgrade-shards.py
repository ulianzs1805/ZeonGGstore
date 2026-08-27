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

  return Array.from({ length: 20 }, (_, id) => {
    const angle = next(id * 9 + 1) * Math.PI * 2;
    const radius = 105 + next(id * 9 + 2) * 155;
    return {
      id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.72,
      rotate: (next(id * 9 + 3) - 0.5) * 210,
      delay: Math.round(next(id * 9 + 4) * 130),
    };
  });
}'''
s, count = particles_re.subn(particles_new, s, count=1)
if count != 1:
    raise SystemExit('makeParticles block not found')

start = s.index('function UpgradeFragmentLayer(')
end = s.index('function WeaponSlot(', start)

replacement = '''function UpgradeFragmentLayer({ leftItem, rightItem, winningItem, phase, particles }: { leftItem: Item | null; rightItem: Item | null; winningItem: Item | null; phase: Phase; particles: Particle[] }) {
  if (phase === "idle" || particles.length === 0) return null;

  return <div className="pointer-events-none absolute inset-0 z-30 grid grid-cols-[.9fr_1.25fr_.9fr] items-center gap-2 sm:gap-8">
    <div className="relative h-full">
      {leftItem && <ShardPack item={leftItem} phase="burst" particles={particles} anchor="left" />}
      {winningItem && phase === "gather" && <ShardPack item={winningItem} phase="gather" particles={particles} anchor="left" />}
    </div>
    <div />
    <div className="relative h-full">
      {rightItem && phase === "burst" && <ShardPack item={rightItem} phase="burst" particles={particles} anchor="right" />}
    </div>
  </div>;
}

function ShardPack({ item, phase, particles, anchor }: { item: Item; phase: "burst" | "gather"; particles: Particle[]; anchor: "left" | "right" }) {
  const safeImage = item.image.replace(/"/g, "%22");
  const cols = 4;
  const rows = 5;
  const tileW = 100 / cols;
  const tileH = 100 / rows;

  const pieces = Array.from({ length: cols * rows }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x0 = col * tileW;
    const x1 = (col + 1) * tileW;
    const y0 = row * tileH;
    const y1 = (row + 1) * tileH;
    const clip = `polygon(${x0 + 1.5}% ${y0 + 2.2}%,${x1 - 2.4}% ${y0 + .8}%,${x1 - .9}% ${y1 - 2.1}%,${x0 + 2.1}% ${y1 - .7}%)`;
    return { index, clip, particle: particles[index % particles.length] };
  });

  const commonStyle: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "min(100%, 180px)",
    height: "80px",
    transform: "translate(-50%, -50%)",
  };

  return <div className={`upgrade-shard-pack upgrade-shard-pack-${anchor} upgrade-shard-pack-${phase}`} style={commonStyle}>
    {pieces.map(({ index, clip, particle }) => {
      const style: CSSProperties & Record<string, string> = {
        left: "0px",
        top: "0px",
        width: "100%",
        height: "100%",
        backgroundImage: `url("${safeImage}")`,
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        clipPath: clip,
        animationDelay: `${phase === "gather" ? particle.delay : index * 8}ms`,
        "--burst-x": `${particle.x}px`,
        "--burst-y": `${particle.y}px`,
        "--r": `${particle.rotate}deg`,
      };

      return <span key={`${item.id}-${anchor}-${phase}-${index}`} className={`upgrade-shard ${phase === "gather" ? "upgrade-shard-gather" : "upgrade-shard-burst"}`} style={style} />;
    })}<style jsx>{`
      .upgrade-shard{position:absolute;display:block;will-change:transform,opacity,filter;opacity:0;transform-origin:50% 50%;filter:drop-shadow(0 0 8px rgba(124,58,237,.35))}
      .upgrade-shard-pack-gather{animation:upgradeShardPackTravel ${GATHER_MS}ms cubic-bezier(.12,.78,.16,1) forwards}
      .upgrade-shard-burst{animation:upgradeShardBurst ${BURST_MS}ms cubic-bezier(.08,.78,.12,1) forwards}
      .upgrade-shard-gather{animation:upgradeShardGather ${GATHER_MS}ms cubic-bezier(.12,.78,.16,1) forwards}
      @keyframes upgradeShardPackTravel{
        0%{left:calc(100% + 50%);top:50%}
        100%{left:50%;top:50%}
      }
      @keyframes upgradeShardBurst{
        0%{opacity:0;transform:translate(0,0) rotate(0deg) scale(.98);filter:brightness(1.02) saturate(1.02) drop-shadow(0 0 8px rgba(124,58,237,.25))}
        4%{opacity:1;transform:translate(0,0) rotate(0deg) scale(1.03);filter:brightness(1.9) saturate(1.3) drop-shadow(0 0 16px rgba(196,181,253,.65))}
        13%{opacity:1;transform:translate(0,0) rotate(0deg) scale(1)}
        100%{opacity:0;transform:translate(var(--burst-x),var(--burst-y)) rotate(var(--r)) scale(.38);filter:brightness(.72) saturate(.88) drop-shadow(0 0 3px rgba(124,58,237,.12))}
      }
      @keyframes upgradeShardGather{
        0%{opacity:0;transform:translate(var(--burst-x),var(--burst-y)) rotate(var(--r)) scale(.38);filter:brightness(1.45) saturate(1.2) drop-shadow(0 0 14px rgba(196,181,253,.6))}
        10%{opacity:1;transform:translate(calc(var(--burst-x) * .72),calc(var(--burst-y) * .72)) rotate(calc(var(--r) * .72)) scale(.56)}
        66%{opacity:1;filter:brightness(1.18) saturate(1.08)}
        100%{opacity:1;transform:translate(0,0) rotate(0deg) scale(1);filter:brightness(1.03) saturate(1.03) drop-shadow(0 0 8px rgba(124,58,237,.18))}
      }
    `}</style>
  </div>;
}

'''

s = s[:start] + replacement + s[end:]
p.write_text(s)
print('radial shatter and exact left-cell gather fixed')
