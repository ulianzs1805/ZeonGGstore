# Keep upgrade animation anchored to the actual skin image boxes.
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

start = s.index('function UpgradeFragmentLayer(')
end = s.index('function WeaponSlot(', start)
s = s[:start] + 'function UpgradeFragmentLayer() { return null; }\n\n' + s[end:]

start = s.index('function WeaponSlot(')
end = s.index('function InventoryPanel(', start)
weapon = '''function WeaponSlot({ item, side, onShuffle, imageHidden, fragmentItem, fragmentMode, particles }: { item: Item | null; side: "left" | "right"; onShuffle: () => void; imageHidden: boolean; fragmentItem?: Item | null; fragmentMode?: "burst" | "gather" | null; particles?: Particle[] }) {
  return <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-center">
    <p className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-500 sm:text-xs">{side === "left" ? "ТВОЙ СКИН" : "ЦЕЛЕВОЙ СКИН"}</p>
    <div className="relative h-20 w-full max-w-[180px] overflow-visible rounded-2xl border border-violet-400/15 bg-[#111424] p-3 shadow-[0_0_30px_rgba(95,48,255,.10)] sm:h-32 sm:max-w-[250px]">
      {item ? <Image src={item.image} alt={item.name} fill className={`object-contain p-3 drop-shadow-[0_0_20px_rgba(116,65,255,.45)] transition-opacity duration-150 ${imageHidden ? "opacity-0" : "opacity-100"}`} unoptimized /> : <div className="grid h-full place-items-center text-[9px] font-black uppercase tracking-[.14em] text-zinc-600">Выбери предмет</div>}
      {fragmentItem && fragmentMode && particles && particles.length > 0 && <ShardPack item={fragmentItem} phase={fragmentMode} particles={particles} />}
    </div>
    <button type="button" onClick={onShuffle} aria-label="Сбросить выбор" disabled={imageHidden} className="grid h-9 w-9 place-items-center rounded-xl border border-violet-400/15 bg-[#171a2b] text-lg text-violet-200 transition hover:bg-violet-500/15 disabled:opacity-50 sm:h-11 sm:w-11">⌘</button>
    {item ? <div className="max-w-[180px]"><p className="truncate text-[10px] font-black sm:text-sm">{item.name}</p><p className="mt-1 text-xs font-black text-[#f2b84d] sm:text-sm">{money(item.price)}Z</p></div> : side === "left" ? <p className="text-[9px] text-zinc-600">Можно играть балансом</p> : null}
  </div>;
}

function ShardPack({ item, phase, particles }: { item: Item; phase: "burst" | "gather"; particles: Particle[] }) {
  const safeImage = item.image.replace(/"/g, "%22");
  const cols = 4;
  const rows = 5;
  const tileW = 100 / cols;
  const tileH = 100 / rows;

  return <div className="pointer-events-none absolute inset-0 z-40 overflow-visible">
    {Array.from({ length: cols * rows }, (_, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x0 = col * tileW;
      const x1 = (col + 1) * tileW;
      const y0 = row * tileH;
      const y1 = (row + 1) * tileH;
      const particle = particles[index % particles.length];
      const clip = `polygon(${x0 + 1.2}% ${y0 + 1.8}%,${x1 - 1.8}% ${y0 + .6}%,${x1 - .8}% ${y1 - 1.7}%,${x0 + 1.6}% ${y1 - .5}%)`;
      const style: CSSProperties & Record<string, string> = {
        backgroundImage: `url("${safeImage}")`,
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        clipPath: clip,
        animationDelay: `${phase === "gather" ? particle.delay : index * 7}ms`,
        "--burst-x": `${particle.x}px`,
        "--burst-y": `${particle.y}px`,
        "--r": `${particle.rotate}deg`,
      };
      return <span key={`${item.id}-${phase}-${index}`} className={`upgrade-shard ${phase === "burst" ? "upgrade-shard-burst" : "upgrade-shard-gather"}`} style={style} />;
    })}
    <style jsx>{`
      .upgrade-shard{position:absolute;inset:0;display:block;opacity:0;will-change:transform,opacity,filter;transform-origin:50% 50%;filter:drop-shadow(0 0 8px rgba(124,58,237,.28))}
      .upgrade-shard-burst{animation:upgradeShardBurst ${BURST_MS}ms cubic-bezier(.08,.78,.12,1) forwards}
      .upgrade-shard-gather{animation:upgradeShardGather ${GATHER_MS}ms cubic-bezier(.12,.78,.16,1) forwards}
      @keyframes upgradeShardBurst{
        0%{opacity:0;transform:translate(0,0) rotate(0deg) scale(.96);filter:brightness(1.04) saturate(1.04)}
        4%{opacity:1;transform:translate(0,0) rotate(0deg) scale(1.04);filter:brightness(1.85) saturate(1.28) drop-shadow(0 0 16px rgba(196,181,253,.6))}
        12%{opacity:1;transform:translate(0,0) rotate(0deg) scale(1)}
        100%{opacity:0;transform:translate(var(--burst-x),var(--burst-y)) rotate(var(--r)) scale(.34);filter:brightness(.72) saturate(.86)}
      }
      @keyframes upgradeShardGather{
        0%{opacity:0;transform:translate(calc(clamp(260px,70vw,880px) + var(--burst-x) * .55),calc(var(--burst-y) * .55)) rotate(var(--r)) scale(.34);filter:brightness(1.55) saturate(1.22) drop-shadow(0 0 15px rgba(196,181,253,.62))}
        10%{opacity:1;transform:translate(calc(clamp(260px,70vw,880px) + var(--burst-x) * .38),calc(var(--burst-y) * .38)) rotate(calc(var(--r) * .72)) scale(.52)}
        66%{opacity:1;filter:brightness(1.18) saturate(1.08)}
        100%{opacity:0;transform:translate(0,0) rotate(0deg) scale(1);filter:brightness(1.03) saturate(1.03) drop-shadow(0 0 8px rgba(124,58,237,.18))}
      }
    `}</style>
  </div>;
}

'''
s = s[:start] + weapon + s[end:]

s = re.sub(
    r'<UpgradeFragmentLayer[^>]*/>\s*',
    '',
    s,
    count=1,
)

left_call = '<WeaponSlot item={displayInput} side="left" onShuffle={() => { setOptimisticInput(null); setInputId(""); }} imageHidden={animating}'
left_repl = '<WeaponSlot item={displayInput} side="left" onShuffle={() => { setOptimisticInput(null); setInputId(""); }} imageHidden={animating} fragmentItem={phase === "burst" ? leftFragments : phase === "gather" ? winningItem : null} fragmentMode={phase === "burst" ? "burst" : phase === "gather" ? "gather" : null} particles={particles}'
s = s.replace(left_call, left_repl, 1)

right_call = '<WeaponSlot item={displayTarget} side="right" onShuffle={() => setTargetId("")} imageHidden={animating}'
right_repl = '<WeaponSlot item={displayTarget} side="right" onShuffle={() => setTargetId("")} imageHidden={animating} fragmentItem={phase === "burst" ? rightFragments : null} fragmentMode={phase === "burst" ? "burst" : null} particles={particles}'
s = s.replace(right_call, right_repl, 1)

p.write_text(s)
print('fixed exact left-cell gather and radial burst')
