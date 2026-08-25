const FABLE_IMAGES: Record<string, string> = {
  "M110 Cyber": "/skins/fable/m110-cyber.png",
  "F/S Tactical": "/skins/fable/fs-tactical.png",
  "Desert Eagle Ace": "/skins/fable/desert-eagle-ace.png",
  "G22 Starfall": "/skins/fable/g22-starfall.png",
  "FNFL Tactical": "/skins/fable/fnfl-tactical.png",
  "UMP45 Cerberus": "/skins/fable/ump45-cerberus.png",
  "USP Pisces": "/skins/fable/usp-pisces.png",
  "MP7 Lich": "/skins/fable/mp7-lich.png",
  "M4 Lizard": "/skins/fable/m4-lizard.png",
  "Tec-9 Fable": "/skins/fable/tec9-fable.png",
  "F/S Venom": "/skins/fable/fs-venom.png",
  "M4 Samurai": "/skins/fable/m4-samurai.png",
  "Butterfly Starfall": "/skins/fable/butterfly-starfall.png",
  "Butterfly Black Window": "/skins/fable/butterfly-black-window.png",
  "Butterfly Legacy": "/skins/fable/butterfly-legacy.png",
  "Butterfly Dragon Glass": "/skins/fable/butterfly-dragon-glass.png",
};

const FABLE_CACHE_VERSION = "fable-png-v3";

export function resolveSkinImage(name: string | null | undefined, image: string | null | undefined) {
  const canonical = name ? FABLE_IMAGES[name.trim()] : undefined;
  const src = canonical ?? (typeof image === "string" ? image.trim() : "");
  if (!src) return "";
  if (!canonical) return src;
  return `${canonical}${canonical.includes("?") ? "&" : "?"}v=${FABLE_CACHE_VERSION}`;
}
