import type { PaletteMapping } from './colors';
import { PixlerImg } from './img';

export type PixlerAppState = {
    fileName: string | undefined;
    error: string | undefined;
    pixlerImg: PixlerImg | undefined;
    showGrid: boolean;
    backgroundColor: string;
    gridColor: string;
    cursorColor: string;
    paletteMapping: PaletteMapping | undefined;
    enableMapping: boolean;
    selectedColorName: string;
};

export const defaultAppState: PixlerAppState = {
    fileName: undefined,
    error: undefined,
    pixlerImg: undefined,
    showGrid: false,
    backgroundColor: '#ffffff',
    gridColor: '#000000',
    cursorColor: '#FF0000',
    paletteMapping: undefined,
    enableMapping: false,
    selectedColorName: '',
};
