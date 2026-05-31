import { formatHex, type Color } from 'culori';
import { Image, readImg } from 'image-js';
import { err, ok, Result } from 'neverthrow';
import { channelsMatch, channelsToColor, nearestColorsFnForPalette, PaletteMapping } from './colors';
import { pixelArtGridFromImage, type PixelArtGrid } from './grid';

export interface ContentBounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
}

export class PixlerImg {
    private readonly srcImg: Image;
    private readonly pixelArtGrid: PixelArtGrid;
    private readonly _backgroundColor: number[];
    private readonly _contentBounds: ContentBounds;
    private _palette: Color[] = []; // readonly, but set in factory rather than constructor

    private constructor(srcImg: Image, pixelArtGrid: PixelArtGrid) {
        this.srcImg = srcImg;
        this.pixelArtGrid = pixelArtGrid;
        // assume the top left corner is the background. this is the case in almost all sprite sheets
        this._backgroundColor = srcImg.getPixel(0, 0);
        this._contentBounds = determineContentBounds(srcImg, this._backgroundColor);
    }

    public get backgroundColor(): number[] {
        return [...this._backgroundColor];
    }

    public get contentBounds(): ContentBounds {
        return { ...this._contentBounds };
    }

    public get palette(): Color[] {
        return [...this._palette];
    }

    public static async create(file: File): Promise<Result<PixlerImg, string>> {
        const bitmap = await createImageBitmap(file);
        const imjsImage = readImg(bitmap);
        bitmap.close();
        return this.createFromImage(imjsImage);
    }

    public static async createFromImage(img: Image): Promise<Result<PixlerImg, string>> {
        const pixelArtGrid = pixelArtGridFromImage(img);
        if (pixelArtGrid.isErr()) {
            return err(pixelArtGrid.error);
        }

        const pixlerImage = new PixlerImg(img, pixelArtGrid.value);

        // determinePalette requires the scale detection to be completed
        // so that way it can skip over the redunant pixels.
        // So, we determine the palette and set it after construction.
        const paletteResult = determinePalette(pixlerImage);
        if (paletteResult.isErr()) {
            return err(paletteResult.error);
        }

        pixlerImage._palette = paletteResult.value;

        Object.freeze(pixlerImage); // enforce immutability for React
        return ok(pixlerImage);
    }

    public get width(): number {
        return this._contentBounds.width / this.pixelArtGrid.scaleX;
    }

    public get height(): number {
        return this._contentBounds.height / this.pixelArtGrid.scaleY;
    }

    public getPixel(x: number, y: number): Result<number[], string> {
        const width = this._contentBounds.width / this.pixelArtGrid.scaleX;
        const height = this._contentBounds.height / this.pixelArtGrid.scaleY;
        if (x < 0 || y < 0 || x >= width || y >= height) {
            return err('Pixel coordinates are out of bounds');
        }
        const imgX = this._contentBounds.left + x * this.pixelArtGrid.scaleX;
        const imgY = this._contentBounds.top + y * this.pixelArtGrid.scaleY;
        const pixel = this.srcImg.getPixel(imgX, imgY);
        return ok(pixel);
    }

    public getDefaultPaletteMapping(paletteByName: Record<string, Color>): Result<PaletteMapping, string> {
        const nearestColorsFn = nearestColorsFnForPalette(paletteByName);
        const outColorNames = this._palette.flatMap((color) => nearestColorsFn(color, 1));
        return PaletteMapping.createPaletteMapping(this._palette, outColorNames, paletteByName);
    }
}

function determinePalette(img: PixlerImg): Result<Color[], string> {
    const paletteMap: Record<string, Color> = {};
    for (let y = 0; y < img.height; y += 1) {
        for (let x = 0; x < img.width; x += 1) {
            const pixelResult = img.getPixel(x, y);
            if (pixelResult.isErr()) {
                return err(pixelResult.error);
            }
            const channels = pixelResult.value;
            if (channelsMatch(channels, [0, 0, 0, 0])) {
                // skip tranparent background
                // unfortunately we can't skip img.backgroundColor
                // since sometimes sprites don't set a distinct background color :(
                continue;
            }
            const colorResult = channelsToColor(channels);
            if (colorResult.isErr()) {
                return err(colorResult.error);
            }
            const color = colorResult.value;
            paletteMap[formatHex(color)] = color;
        }
    }
    return ok(Object.values(paletteMap));
}

function determineContentBounds(img: Image, backgroundColor: number[]): ContentBounds {
    let left = img.width,
        right = -1,
        top = img.height,
        bottom = -1;
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            const pixel = img.getPixel(x, y);
            if (!channelsMatch(pixel, backgroundColor)) {
                if (x < left) left = x;
                if (x > right) right = x;
                if (y < top) top = y;
                if (y > bottom) bottom = y;
            }
        }
    }
    const width = right >= left ? right - left + 1 : 0;
    const height = bottom >= top ? bottom - top + 1 : 0;
    return { left, right, top, bottom, width, height };
}
