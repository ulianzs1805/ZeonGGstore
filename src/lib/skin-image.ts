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

const IMAGE_CACHE_VERSION = "skin-assets-v2";

function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\\/]+/g, " ")
    .replace(/[^a-z0-9а-яё]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const IMAGE_BY_NORMALIZED_NAME = Object.fromEntries(
  Object.entries(FABLE_IMAGES).map(([name, path]) => [normalizeName(name), path]),
);

function withCacheVersion(src: string) {
  if (!src.startsWith("/")) return src;
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}v=${IMAGE_CACHE_VERSION}`;
}

export function resolveSkinImage(name: string | null | undefined, image: string | null | undefined) {
  const normalizedName = typeof name === "string" ? normalizeName(name) : "";
  const canonical = normalizedName ? IMAGE_BY_NORMALIZED_NAME[normalizedName] : undefined;
  const src = canonical ?? (typeof image === "string" ? image.trim() : "");
  if (!src) return "";
  return withCacheVersion(src);
}
