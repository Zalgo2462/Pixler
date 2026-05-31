import type { Color } from 'culori';
import { describe, expect, it } from 'vitest';
import { nearestColorsFnForPalette } from './colors';
import { COLOR_PALETTE } from './palettes/perler-palette';

function mapColorsToNearestPaletteColor(inColors: Color[], colorPalette: Record<string, Color>): string[] {
    const nearestColorsFn = nearestColorsFnForPalette(colorPalette);

    return inColors.flatMap((color) => nearestColorsFn(color, 1));
}

describe('nearestColorsFnForPalette accurately finds the nearest colors', () => {
    const NEON_PALETTE: Record<string, Color> = {
        'Neon Pink': { mode: 'rgb', r: 0.9137, g: 0.3608, b: 0.6588 },
        'Neon Yellow': { mode: 'rgb', r: 0.7333, g: 0.7608, b: 0.1961 },
        'Neon Orange': { mode: 'rgb', r: 0.8667, g: 0.5686, b: 0.2196 },
        'Neon Green': { mode: 'rgb', r: 0.0, g: 0.6824, b: 0.3765 },
        'Neon Blue': { mode: 'rgb', r: 0.2353, g: 0.3373, b: 0.7137 },
    };
    it('maps a palette to itself', () => {
        let inColors: Color[] = [];
        let expectedColorNames: string[] = [];
        for (const colorName in NEON_PALETTE) {
            inColors.push(NEON_PALETTE[colorName]);
            expectedColorNames.push(colorName);
        }
        const mapResults = mapColorsToNearestPaletteColor(inColors, NEON_PALETTE);
        expect(mapResults).toEqual(expectedColorNames);
    });

    it('maps a known example properly', () => {
        const inputColors: Color[] = [
            {
                mode: 'rgb',
                r: 0.054901960784313725,
                g: 0.2196078431372549,
                b: 0.03137254901960784,
                alpha: 1,
            },
            {
                mode: 'rgb',
                r: 0,
                g: 0.5568627450980392,
                b: 0,
                alpha: 1,
            },
            {
                mode: 'rgb',
                r: 0.24705882352941178,
                g: 0.7686274509803922,
                b: 0.011764705882352941,
                alpha: 1,
            },
            {
                mode: 'rgb',
                r: 0.08627450980392157,
                g: 0.34509803921568627,
                b: 0,
                alpha: 1,
            },
            {
                mode: 'rgb',
                r: 0.13725490196078433,
                g: 0.4549019607843137,
                b: 0,
                alpha: 1,
            },
            {
                mode: 'rgb',
                r: 0.3568627450980392,
                g: 1,
                b: 0.10980392156862745,
                alpha: 1,
            },
            {
                mode: 'rgb',
                r: 0.2549019607843137,
                g: 0.3607843137254902,
                b: 0.10588235294117647,
                alpha: 1,
            },
            {
                mode: 'rgb',
                r: 0.8901960784313725,
                g: 1,
                b: 0.8,
                alpha: 1,
            },
            {
                mode: 'rgb',
                r: 0.6666666666666666,
                g: 0.8666666666666667,
                b: 0.39215686274509803,
                alpha: 1,
            },
        ];
        const expectedColorNames = [
            'Evergreen',
            'Shamrock',
            'Kiwi Lime',
            'Dark Green',
            'Dark Green',
            'Sour Apple',
            'Olive',
            'Creme',
            'Sour Apple',
        ];
        expect(mapColorsToNearestPaletteColor(inputColors, COLOR_PALETTE)).toEqual(expectedColorNames);
    });
});
