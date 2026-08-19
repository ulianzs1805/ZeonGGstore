const sharp = require('sharp');
const fs = require('fs');

const input = 'public/skins/awm-winter-sport.png';
const output = input; // overwrite

(async () => {
  if (!fs.existsSync(input)) {
    console.error('Input file not found:', input);
    process.exit(1);
  }

  try {
    const image = sharp(input).ensureAlpha();
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info; // channels should be 4 because ensureAlpha
    const out = Buffer.from(data); // mutable

    const threshold = 16; // consider near-black as background

    for (let i = 0; i < out.length; i += channels) {
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const aIndex = i + 3;

      // If pixel is near black and not already transparent
      if (r <= threshold && g <= threshold && b <= threshold) {
        out[aIndex] = 0;
      }
    }

    await sharp(out, { raw: { width, height, channels } }).png().toFile(output + '.tmp.png');
    fs.renameSync(output + '.tmp.png', output);

    console.log('Processed', input, '-> background made transparent (threshold:', threshold, ')');
  } catch (err) {
    console.error('Error processing image:', err);
    process.exit(1);
  }
})();
