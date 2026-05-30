import { Image, write } from 'image-js';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, '../src/improc/test-assets');

const colors = {
  background: [255, 255, 255, 255],
  content: [74, 112, 160, 255],
  accent: [235, 157, 52, 255],
  noise: [200, 200, 200, 255],
};

function createImage(width, height, color = colors.background) {
  const img = new Image(width, height, { colorModel: 'RGBA' });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      img.setPixel(x, y, color);
    }
  }
  return img;
}

function fillRect(img, x, y, width, height, color) {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      img.setPixel(col, row, color);
    }
  }
}

function writeImage(filename, image) {
  const destination = join(outputDir, filename);
  return write(destination, image, { recursive: true });
}

async function ensureOutputDir() {
  try {
    await stat(outputDir);
  } catch {
    await mkdir(outputDir, { recursive: true });
  }
}

const gridScales = [3, 8, 12, 16, 24];

function generateCenteredBlock(scale) {
  const width = scale * 3;
  const height = scale * 3;
  const offset = scale;
  const image = createImage(width, height);
  fillRect(image, offset, offset, scale, scale, colors.content);
  return { filename: `generated-centered-block-${scale}.png`, image };
}

function generateRegularGrid(scale) {
  const spacing = scale;
  const columns = 5;
  const rows = 4;
  const padding = scale * 2;
  const width = padding * 2 + columns * scale + (columns - 1) * spacing;
  const height = padding * 2 + rows * scale + (rows - 1) * spacing;
  const image = createImage(width, height);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const x = padding + col * (scale + spacing);
      const y = padding + row * (scale + spacing);
      fillRect(image, x, y, scale, scale, row % 2 === 0 ? colors.content : colors.accent);
    }
  }

  return { filename: `generated-regular-grid-${scale}.png`, image };
}

function generateOffsetGrid(scale) {
  const spacing = scale;
  const columns = 6;
  const rows = 6;
  const offsetX = scale + 3;
  const offsetY = scale + 2;
  const width = offsetX + columns * scale + (columns - 1) * spacing + scale;
  const height = offsetY + rows * scale + (rows - 1) * spacing + scale;
  const image = createImage(width, height);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const x = offsetX + col * (scale + spacing);
      const y = offsetY + row * (scale + spacing);
      fillRect(image, x, y, scale, scale, (col + row) % 2 === 0 ? colors.content : colors.accent);
    }
  }

  return { filename: `generated-offset-grid-${scale}.png`, image };
}

function generateMixedRunLengthGrid(scale) {
  const spacing = 0;
  const offsetX = scale + 3;
  const offsetY = scale + 2;
  const rows = 6;
  const rowRuns = [
    [2, 1, 3, 2],
    [1, 2, 2, 3],
    [3, 1, 2, 2],
    [2, 3, 1, 2],
    [1, 4, 2, 1],
    [2, 1, 4, 1],
  ];
  const totalCells = Math.max(...rowRuns.map((row) => row.reduce((sum, run) => sum + run, 0)));
  const width = offsetX + totalCells * scale + scale * 2;
  const height = offsetY + rows * scale + scale * 2;
  const image = createImage(width, height);
  const colorsByRun = [colors.content, colors.accent, [140, 180, 120, 255], [210, 130, 175, 255]];

  for (let row = 0; row < rows; row += 1) {
    let cellX = 0;
    for (let runIndex = 0; runIndex < rowRuns[row].length; runIndex += 1) {
      const runLength = rowRuns[row][runIndex];
      const x = offsetX + cellX * scale;
      const y = offsetY + row * scale;
      const widthRun = runLength * scale;
      const fillColor = colorsByRun[runIndex % colorsByRun.length];
      fillRect(image, x, y, widthRun, scale, fillColor);
      cellX += runLength;
    }
  }

  return { filename: `generated-mixed-run-length-grid-${scale}.png`, image };
}

function generateGridVariants() {
  return gridScales.flatMap((scale) => [
    generateCenteredBlock(scale),
    generateRegularGrid(scale),
    generateOffsetGrid(scale),
    generateMixedRunLengthGrid(scale),
  ]);
}

async function main() {
  await ensureOutputDir();

  const assets = generateGridVariants();

  await Promise.all(assets.map(({ filename, image }) => writeImage(filename, image)));
  console.log('Generated test images:', assets.map(asset => asset.filename).join(', '));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
