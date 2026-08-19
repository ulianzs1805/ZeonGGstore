const sharp = require('sharp');
const fs = require('fs');

const input = 'public/skins/awm-winter-sport.png';
const output = input; // overwrite

function idx(x, y, width, channels) {
  return (y * width + x) * channels;
}

(async () => {
  if (!fs.existsSync(input)) {
    console.error('Input file not found:', input);
    process.exit(1);
  }

  try {
    const image = sharp(input).ensureAlpha();
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info; // channels should be 4
    const out = Buffer.from(data); // mutable

    const threshold = 30; // tolerance for near-black

    const visited = new Uint8Array(width * height);
    const queue = [];

    // enqueue border pixels that are near-black
    for (let x = 0; x < width; x++) {
      queue.push([x, 0]);
      queue.push([x, height - 1]);
    }
    for (let y = 0; y < height; y++) {
      queue.push([0, y]);
      queue.push([width - 1, y]);
    }

    const isNearBlack = (r, g, b) => {
      return r <= threshold && g <= threshold && b <= threshold;
    };

    while (queue.length) {
      const [x, y] = queue.shift();
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const p = y * width + x;
      if (visited[p]) continue;
      visited[p] = 1;

      const i = idx(x, y, width, channels);
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];

      if (isNearBlack(r, g, b)) {
        // set alpha to 0
        out[i + 3] = 0;
        // push neighbours
        queue.push([x + 1, y]);
        queue.push([x - 1, y]);
        queue.push([x, y + 1]);
        queue.push([x, y - 1]);
      }
    }

    await sharp(out, { raw: { width, height, channels } }).png().toFile(output + '.tmp.png');
    fs.renameSync(output + '.tmp.png', output);

    console.log('Flood-fill processed', input, '-> background made transparent (threshold:', threshold, ')');
  } catch (err) {
    console.error('Error processing image:', err);
    process.exit(1);
  }
})();
