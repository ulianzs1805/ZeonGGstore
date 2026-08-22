const SKIN_PATH_PREFIX = "/skins/";
const OPTIMIZED_ROUTE = "/api/skin-image";

export function getOptimizedSkinImage(image: string, width = 512): string {
  if (!image || !image.startsWith(SKIN_PATH_PREFIX)) return image;

  const params = new URLSearchParams({
    src: image,
    w: String(width),
  });

  return `${OPTIMIZED_ROUTE}?${params.toString()}`;
}
