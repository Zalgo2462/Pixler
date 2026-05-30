import { PixlerImg } from './img';

export type PixlerAppState = {
    fileName: string | null;
    error: string | null;
    pixlerImg: PixlerImg | null;
    showGrid: boolean;
    backgroundColor: string;
    gridColor: string;
    cursorColor: string;
};

export const defaultAppState: PixlerAppState = {
    fileName: null,
    error: null,
    pixlerImg: null,
    showGrid: false,
    backgroundColor: '#ffffff',
    gridColor: '#3e3e3e',
    cursorColor: '#FF0000',
};
