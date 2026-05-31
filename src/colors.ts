import { type Color, differenceCiede2000, formatHex, hsv, nearest, rgb } from 'culori';
import { err, ok, type Result } from 'neverthrow';

export function debugColor(color: Color, label: string = 'Color Log'): void {
    const hex = formatHex(color);

    if (!hex) {
        console.warn('Invalid color object passed to logger.');
        return;
    }

    // Visualizing the color inline
    console.log(
        `%c    %c ${label}: %c${hex}`,
        `background: ${hex}; border: 1px solid #777; padding: 1px 10px; border-radius: 2px;`, // Color block
        'font-weight: bold; color: #888;', // Label text
        `color: ${hex}; font-weight: bold; font-family: monospace;`,
    );
}

export function imagejsChannelsToColor(channels: number[]): Result<Color, string> {
    if (channels.length === 3) {
        return ok({
            mode: 'rgb',
            r: channels[0] / 255,
            g: channels[1] / 255,
            b: channels[2] / 255,
        });
    } else if (channels.length == 4) {
        return ok({
            mode: 'rgb',
            r: channels[0] / 255,
            g: channels[1] / 255,
            b: channels[2] / 255,
            alpha: channels[3] / 255,
        });
    }
    return err(`could not convert pixel with ${channels.length} to culori color`);
}

export function channelsMatch(p1: number[], p2: number[]): boolean {
    if (p1.length != p2.length) {
        return false;
    }
    return p1.every((p1Channel, idx) => p1Channel === p2[idx]);
}

export function nearestColorsFnForPalette(paletteByName: Record<string, Color>): (c: Color, num: number) => string[] {
    const paletteNames = Object.keys(paletteByName);

    return nearest(paletteNames, differenceCiede2000(), (name) => paletteByName[name]);
}

interface LookupTable {
    hexToHex: Record<string, string>;
    numToNum: Record<number, number>;
}

function colorToRGBNumber(color: Color): number {
    if (color.mode !== 'rgb') {
        color = rgb(color);
    }
    let retVal = 0;
    retVal |= Math.round(Math.max(0, Math.min(1, color.r) * 255)) << 16;
    retVal |= Math.round(Math.max(0, Math.min(1, color.g) * 255)) << 8;
    retVal |= Math.round(Math.max(0, Math.min(1, color.b) * 255));
    return retVal;
}

function createLookupTable(inColors: Color[], outColors: Color[]): Result<LookupTable, string> {
    if (inColors.length !== outColors.length) {
        return err('createLookupTable: length of inColors must match length of outColors');
    }
    const lut: LookupTable = { hexToHex: {}, numToNum: {} };
    for (let i = 0; i < inColors.length; i++) {
        lut.hexToHex[formatHex(inColors[i])] = formatHex(outColors[i]);
        lut.numToNum[colorToRGBNumber(inColors[i])] = colorToRGBNumber(outColors[i]);
    }
    Object.freeze(lut.hexToHex);
    Object.freeze(lut.numToNum);
    Object.freeze(lut);
    return ok(lut);
}

export class PaletteMapping {
    private readonly _inColors: Color[];
    private readonly _outColors: Color[];
    private readonly _outColorNames: string[];
    private readonly _outColorNamesByHex: Record<string, string>;
    private readonly _lookupTable: LookupTable;

    private constructor(inColors: Color[], outColors: Color[], outColorNames: string[], lookupTable: LookupTable) {
        this._inColors = inColors;
        this._outColors = outColors;
        this._outColorNames = outColorNames;
        this._lookupTable = lookupTable;
        this._outColorNamesByHex = {};
        for (let i = 0; i < this._outColors.length; i++) {
            this._outColorNamesByHex[formatHex(this._outColors[i])] = this._outColorNames[i];
        }
        Object.freeze(this);
    }

    public static createPaletteMapping(
        inColors: Color[],
        outColorNames: string[],
        paletteByName: Record<string, Color>,
    ): Result<PaletteMapping, string> {
        const hsvSortIndexes = determineHsvSortPermutation(inColors);
        inColors = hsvSortIndexes.map((idx) => inColors[idx]);
        outColorNames = hsvSortIndexes.map((idx) => outColorNames[idx]);

        const outColors = outColorNames.map((colorName) => paletteByName[colorName]);
        const lutResult = createLookupTable(inColors, outColors);
        if (lutResult.isErr()) {
            return err(lutResult.error);
        }
        return ok(new PaletteMapping(inColors, outColors, outColorNames, lutResult.value));
    }

    public updateMapping(
        inColor: Color,
        outColorName: string,
        paletteByName: Record<string, Color>,
    ): Result<PaletteMapping, string> {
        let newInColors = [...this._inColors];
        let newOutColorNames: string[] = [];
        let found = false;
        for (let i = 0; i < newInColors.length; i++) {
            if (formatHex(newInColors[i]) === formatHex(inColor)) {
                newOutColorNames.push(outColorName);
                found = true;
            } else {
                newOutColorNames.push(this._outColorNames[i]);
            }
        }
        if (!found) {
            newInColors.push(inColor);
            newOutColorNames.push(outColorName);
        }
        return PaletteMapping.createPaletteMapping(newInColors, newOutColorNames, paletteByName);
    }

    public getInputColors(): Color[] {
        return [...this._inColors];
    }

    public getNameForOutputColor(outColorHex: string): string {
        return this._outColorNamesByHex[outColorHex];
    }

    public mapHexColorToOutputHexColor(color: string): string {
        return this._lookupTable.hexToHex[color];
    }

    public mapHexColorToOutputName(color: string): string {
        return this._outColorNamesByHex[this.mapHexColorToOutputHexColor(color)];
    }

    public mapPixiColor(color: number): number {
        return this._lookupTable.numToNum[color];
    }
}

function determineHsvSortPermutation(colors: Color[]): number[] {
    const indexed = colors.map((color, originalIndex) => {
        const hsvColor = hsv(color);
        return {
            originalIndex,
            h: hsvColor.h ?? 0,
            s: hsvColor.s ?? 0,
            v: hsvColor.v ?? 0,
        };
    });

    // 2. Sort the structural configurations by HSV metadata rules
    indexed.sort((a, b) => {
        if (a.h !== b.h) return a.h - b.h;
        if (a.s !== b.s) return a.s - b.s;
        return a.v - b.v;
    });

    // 3. Extract just the sorted trail of original index markers
    return indexed.map((item) => item.originalIndex);
}
