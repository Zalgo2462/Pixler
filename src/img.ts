import { Image, readImg } from 'image-js';
import { err, ok, Result } from 'neverthrow';
import { gcd } from './math';

export interface PixelArtGrid {
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
}

export type BackgroundDetectionMode = 'top-left' | 'mode';

export interface PixlerCreateOptions {
    backgroundDetection?: BackgroundDetectionMode;
}

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

    private constructor(
        srcImg: Image,
        pixelArtGrid: PixelArtGrid,
        options: PixlerCreateOptions,
    ) {
        this.srcImg = srcImg;
        this.pixelArtGrid = pixelArtGrid;
        const backgroundDetection = options.backgroundDetection ?? 'top-left';
        this._backgroundColor = determineBackgroundColor(
            srcImg,
            backgroundDetection,
        );
        this._contentBounds = determineContentBounds(
            srcImg,
            this._backgroundColor,
        );
    }

    public get backgroundColor(): number[] {
        return [...this._backgroundColor];
    }

    public get contentBounds(): ContentBounds {
        return { ...this._contentBounds };
    }

    public static async create(
        file: File,
        options: PixlerCreateOptions = {},
    ): Promise<Result<PixlerImg, string>> {
        const bitmap = await createImageBitmap(file);
        const imjsImage = readImg(bitmap);
        bitmap.close();
        return this.createFromImage(imjsImage, options);
    }

    public static async createFromImage(
        img: Image,
        options: PixlerCreateOptions = {},
    ): Promise<Result<PixlerImg, string>> {
        const pixelArtGrid = pixelArtGridFromImage(img);
        if (pixelArtGrid.isErr()) {
            return err(pixelArtGrid.error);
        }

        return ok(new PixlerImg(img, pixelArtGrid.value, options));
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
        if (pixelsMatch(pixel, this._backgroundColor)) {
            return ok([0, 0, 0, 0]);
        }
        return ok(pixel);
    }
}

export function pixelArtGridFromImage(
    img: Image,
): Result<PixelArtGrid, string> {
    const maxSearchDepth = 4; // depth = 4 results in checking at most 16 rows/ columns for run lengths
    const horizontalRunLengthsResult = searchForHorizontalRunLengths(
        img,
        maxSearchDepth,
    );
    if (horizontalRunLengthsResult.isErr()) {
        return err(horizontalRunLengthsResult.error);
    }
    const verticalRunLengthsResult = searchForVerticalRunLengths(
        img,
        maxSearchDepth,
    );
    if (verticalRunLengthsResult.isErr()) {
        return err(verticalRunLengthsResult.error);
    }
    const scaleXResult = getScaleFromRunLengths(
        horizontalRunLengthsResult.value,
    );
    if (scaleXResult.isErr()) {
        return err(scaleXResult.error);
    }
    const scaleYResult = getScaleFromRunLengths(verticalRunLengthsResult.value);
    if (scaleYResult.isErr()) {
        return err(scaleYResult.error);
    }
    const offsetXResult =
        horizontalRunLengthsResult.value[0] % scaleXResult.value;
    const offsetYResult =
        verticalRunLengthsResult.value[0] % scaleYResult.value;
    return ok({
        scaleX: scaleXResult.value,
        scaleY: scaleYResult.value,
        offsetX: offsetXResult,
        offsetY: offsetYResult,
    });
}

function searchForHorizontalRunLengths(
    img: Image,
    maxDepth: number,
): Result<number[], string> {
    return searchForHorizontalRunLengthsHelper(img, 0, img.height, 0, maxDepth);
}

function searchForHorizontalRunLengthsHelper(
    img: Image,
    startY: number,
    endY: number,
    currDepth: number,
    maxDepth: number,
): Result<number[], string> {
    if (startY >= endY) {
        return err(
            'searchForHorizontalRunLengths: could not find sample row with enough content',
        );
    }
    if (currDepth > maxDepth) {
        return err(
            'searchForHorizontalRunLengths: could not find sample row with enough content',
        );
    }

    const midY = Math.floor((startY + endY) / 2);
    const runLengths = horizontalRunLengths(img, midY);
    if (runLengths.length >= 3) {
        // <pad> <content> <pad>
        return ok(runLengths);
    }
    if (endY - startY === 1) {
        return err(
            'searchForHorizontalRunLengths: could not find sample row with enough content',
        );
    }

    const leftRuns = searchForHorizontalRunLengthsHelper(
        img,
        startY,
        midY,
        currDepth + 1,
        maxDepth,
    );
    if (leftRuns.isOk()) {
        return leftRuns;
    }

    const rightRuns = searchForHorizontalRunLengthsHelper(
        img,
        midY + 1,
        endY,
        currDepth + 1,
        maxDepth,
    );
    if (rightRuns.isOk()) {
        return rightRuns;
    }

    // return the error value up from either left or right since they're the same error
    return leftRuns;
}

function searchForVerticalRunLengths(
    img: Image,
    maxDepth: number,
): Result<number[], string> {
    return searchForVerticalRunLengthsHelper(img, 0, img.width, 0, maxDepth);
}

function searchForVerticalRunLengthsHelper(
    img: Image,
    startX: number,
    endX: number,
    currDepth: number,
    maxDepth: number,
): Result<number[], string> {
    if (startX >= endX) {
        return err(
            'searchForVerticalRunLengths: could not find sample column with enough content',
        );
    }
    if (currDepth > maxDepth) {
        return err(
            'searchForVerticalRunLengths: could not find sample column with enough content',
        );
    }

    const midX = Math.floor((startX + endX) / 2);
    const runLengths = verticalRunLengths(img, midX);
    if (runLengths.length >= 3) {
        // <pad> <content> <pad>
        return ok(runLengths);
    }
    if (endX - startX === 1) {
        return err(
            'searchForVerticalRunLengths: could not find sample column with enough content',
        );
    }

    const leftRuns = searchForVerticalRunLengthsHelper(
        img,
        startX,
        midX,
        currDepth + 1,
        maxDepth,
    );
    if (leftRuns.isOk()) {
        return leftRuns;
    }

    const rightRuns = searchForVerticalRunLengthsHelper(
        img,
        midX + 1,
        endX,
        currDepth + 1,
        maxDepth,
    );
    if (rightRuns.isOk()) {
        return rightRuns;
    }

    return leftRuns;
}

function horizontalRunLengths(img: Image, y: number): number[] {
    let currRun = 1;
    let currPixelValue = img.getPixel(0, y);
    let runs: number[] = [];
    for (let i = 1; i < img.width; i++) {
        let nextPixelValue = img.getPixel(i, y);
        if (pixelsMatch(currPixelValue, nextPixelValue)) {
            currRun++;
        } else {
            runs.push(currRun);
            currRun = 1;
            currPixelValue = nextPixelValue;
        }
    }
    runs.push(currRun);
    return runs;
}

function verticalRunLengths(img: Image, x: number): number[] {
    let currRun = 1;
    let currPixelValue = img.getPixel(x, 0);
    let runs: number[] = [];
    for (let j = 1; j < img.height; j++) {
        let nextPixelValue = img.getPixel(x, j);
        if (pixelsMatch(currPixelValue, nextPixelValue)) {
            currRun++;
        } else {
            runs.push(currRun);
            currRun = 1;
            currPixelValue = nextPixelValue;
        }
    }
    runs.push(currRun);
    return runs;
}

function pixelsMatch(p1: number[], p2: number[]): boolean {
    if (p1.length != p2.length) {
        return false;
    }
    return p1.every((p1Channel, idx) => p1Channel === p2[idx]);
}

function getScaleFromRunLengths(runLengths: number[]): Result<number, string> {
    if (runLengths.length < 3) {
        return err('getScaleFromRunLengths: invalid run length count');
    }
    return ok(runLengths.slice(1, -1).reduce(gcd));
}

function determineBackgroundColor(
    img: Image,
    method: BackgroundDetectionMode,
): number[] {
    if (method === 'top-left') {
        return img.getPixel(0, 0);
    } else {
        return modeColor(img);
    }
}

function modeColor(img: Image): number[] {
    const colorCounts: Map<string, { color: number[]; count: number }> =
        new Map();
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            const pixel = img.getPixel(x, y);
            const key = pixel.join(',');
            const existing = colorCounts.get(key);
            if (existing) {
                existing.count++;
            } else {
                colorCounts.set(key, { color: pixel, count: 1 });
            }
        }
    }

    let maxCount = 0;
    let mostCommonColor: number[] = img.getPixel(0, 0);
    for (const [_, { color, count }] of colorCounts) {
        if (count > maxCount) {
            maxCount = count;
            mostCommonColor = color;
        }
    }

    return mostCommonColor;
}

function determineContentBounds(
    img: Image,
    backgroundColor: number[],
): ContentBounds {
    let left = img.width,
        right = -1,
        top = img.height,
        bottom = -1;
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            const pixel = img.getPixel(x, y);
            if (!pixelsMatch(pixel, backgroundColor)) {
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
