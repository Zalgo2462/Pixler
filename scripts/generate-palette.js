import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// 💡 Import hsv directly from culori for script-time calculations
import { hsv } from 'culori';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_FILE = path.join(__dirname, '..', 'palettes', 'perler-palette.csv');
const OUTPUT_TS_FILE = path.join(__dirname, '..', 'src', 'palettes', 'perler-palette.ts');

function trimQuotes(str) {
    let cleaned = str.trim();

    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        return cleaned.slice(1, -1).trim();
    }

    return cleaned;
}

function generateTsPalette() {
    if (!fs.existsSync(CSV_FILE)) {
        console.error(`Cannot find file at: ${CSV_FILE}`);
        return;
    }

    const fileContent = fs.readFileSync(CSV_FILE, 'utf-8');
    const lines = fileContent.split(/\r?\n/);

    // 1. Array to store raw parsed entities before we sort them
    const parsedColors = [];

    for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) continue;

        const parts = trimmed.split(',');
        if (parts.length < 2) continue;

        const name = trimQuotes(parts[0].trim());
        const hex = trimQuotes(parts[1].trim());

        if (name === 'name') {
            continue;
        }

        const hexClean = hex.replace('#', '');
        const r = parseInt(hexClean.substring(0, 2), 16) / 255;
        const g = parseInt(hexClean.substring(2, 4), 16) / 255;
        const b = parseInt(hexClean.substring(4, 6), 16) / 255;

        // Create a real temporary culori object to feed into the hsv calculator
        const tempColor = { mode: 'rgb', r, g, b };
        const hsvMetrics = hsv(tempColor);

        parsedColors.push({
            name,
            r,
            g,
            b,
            // Fallback metrics to handle neutral grayscales safely
            h: hsvMetrics?.h ?? 0,
            s: hsvMetrics?.s ?? 0,
            v: hsvMetrics?.v ?? 0,
        });
    }

    // 2. Sort the array by Hue (spectrum angle), Saturation (intensity), and Value (brightness)
    parsedColors.sort((a, b) => {
        if (a.h !== b.h) return a.h - b.h;
        if (a.s !== b.s) return a.s - b.s;
        return a.v - b.v;
    });

    // 3. Map out the sorted entities into clean TypeScript template definitions
    const nameToColorEntries = parsedColors.map((item) => {
        const valueString = `{ mode: 'rgb', r: ${item.r.toFixed(4)}, g: ${item.g.toFixed(4)}, b: ${item.b.toFixed(4)} }`;
        return `    "${item.name}": ${valueString},`;
    });

    // 4. Generate the streamlined single-map file template
    const tsTemplate = `import type { Color } from 'culori';

// Map: Name -> Culori Color (Sorted by HSV Rainbow Ordering)
export const COLOR_PALETTE: Record<string, Color> = Object.freeze({
${nameToColorEntries.join('\n')}
});

export type PaletteColorName = keyof typeof COLOR_PALETTE;
`;

    fs.writeFileSync(OUTPUT_TS_FILE, tsTemplate, 'utf-8');
    console.log(`Successfully generated sorted type-safe TypeScript palette at: ${OUTPUT_TS_FILE}`);
}

generateTsPalette();
