import { read } from 'image-js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { pixelArtGridFromImage } from './grid';
import { PixlerImg } from './img';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetDir = join(__dirname, 'test-assets');

const expectedGridValuesByFile = {
    'generated-centered-block-3.png': {
        scaleX: 3,
        scaleY: 3,
        offsetX: 0,
        offsetY: 0,
    },
    'generated-centered-block-8.png': {
        scaleX: 8,
        scaleY: 8,
        offsetX: 0,
        offsetY: 0,
    },
    'generated-centered-block-12.png': {
        scaleX: 12,
        scaleY: 12,
        offsetX: 0,
        offsetY: 0,
    },
    'generated-centered-block-16.png': {
        scaleX: 16,
        scaleY: 16,
        offsetX: 0,
        offsetY: 0,
    },
    'generated-centered-block-24.png': {
        scaleX: 24,
        scaleY: 24,
        offsetX: 0,
        offsetY: 0,
    },
    'generated-regular-grid-3.png': {
        scaleX: 3,
        scaleY: 3,
        offsetX: 0,
        offsetY: 0,
    },
    'generated-regular-grid-8.png': {
        scaleX: 8,
        scaleY: 8,
        offsetX: 0,
        offsetY: 0,
    },
    'generated-regular-grid-12.png': {
        scaleX: 12,
        scaleY: 12,
        offsetX: 0,
        offsetY: 0,
    },
    'generated-regular-grid-16.png': {
        scaleX: 16,
        scaleY: 16,
        offsetX: 0,
        offsetY: 0,
    },
    'generated-regular-grid-24.png': {
        scaleX: 24,
        scaleY: 24,
        offsetX: 0,
        offsetY: 0,
    },
    'generated-offset-grid-3.png': {
        scaleX: 3,
        scaleY: 3,
        offsetX: 0,
        offsetY: 2,
    },
    'generated-offset-grid-8.png': {
        scaleX: 8,
        scaleY: 8,
        offsetX: 3,
        offsetY: 2,
    },
    'generated-offset-grid-12.png': {
        scaleX: 12,
        scaleY: 12,
        offsetX: 3,
        offsetY: 2,
    },
    'generated-offset-grid-16.png': {
        scaleX: 16,
        scaleY: 16,
        offsetX: 3,
        offsetY: 2,
    },
    'generated-offset-grid-24.png': {
        scaleX: 24,
        scaleY: 24,
        offsetX: 3,
        offsetY: 2,
    },
    'generated-mixed-run-length-grid-3.png': {
        scaleX: 3,
        scaleY: 3,
        offsetX: 0,
        offsetY: 2,
    },
    'generated-mixed-run-length-grid-8.png': {
        scaleX: 8,
        scaleY: 8,
        offsetX: 3,
        offsetY: 2,
    },
    'generated-mixed-run-length-grid-12.png': {
        scaleX: 12,
        scaleY: 12,
        offsetX: 3,
        offsetY: 2,
    },
    'generated-mixed-run-length-grid-16.png': {
        scaleX: 16,
        scaleY: 16,
        offsetX: 3,
        offsetY: 2,
    },
    'generated-mixed-run-length-grid-24.png': {
        scaleX: 24,
        scaleY: 24,
        offsetX: 3,
        offsetY: 2,
    },
} as const;

const generatedFiles = Object.keys(expectedGridValuesByFile).sort() as Array<keyof typeof expectedGridValuesByFile>;

describe('pixelArtGridFromImage generated fixtures', () => {
    it.each(generatedFiles)('detects grid for %s', async (filename) => {
        const filePath = join(assetDir, filename);
        const img = await read(filePath);
        const result = pixelArtGridFromImage(img);

        expect(result.isOk(), `expected ${filename} to parse`).toBe(true);
        if (result.isErr()) {
            throw new Error(`${filename} failed: ${result.error}`);
        }

        const expected = expectedGridValuesByFile[filename];
        expect(result.value.scaleX, `${filename}: scaleX`).toBe(expected.scaleX);
        expect(result.value.scaleY, `${filename}: scaleY`).toBe(expected.scaleY);
        expect(result.value.offsetX, `${filename}: offsetX`).toBe(expected.offsetX);
        expect(result.value.offsetY, `${filename}: offsetY`).toBe(expected.offsetY);
    });

    it('finds the correct content bounds for generated-mixed-run-length-grid-24.png', async () => {
        const filename = 'generated-mixed-run-length-grid-24.png';
        const filePath = join(assetDir, filename);
        const img = await read(filePath);
        const pixlerResult = await PixlerImg.createFromImage(img);

        expect(pixlerResult.isOk(), `${filename}: expected PixlerImage to create`).toBe(true);
        if (pixlerResult.isErr()) {
            throw new Error(`${filename} failed: ${pixlerResult.error}`);
        }

        const pixlerImg = pixlerResult.value;
        const bounds = pixlerImg.contentBounds;

        expect(bounds).toEqual({
            left: 27,
            right: 218,
            top: 26,
            bottom: 169,
            width: 192,
            height: 144,
        });
    });

    it('supports width, height, and getPixel for generated-mixed-run-length-grid-24.png', async () => {
        const filename = 'generated-mixed-run-length-grid-24.png';
        const filePath = join(assetDir, filename);
        const img = await read(filePath);
        const pixlerResult = await PixlerImg.createFromImage(img);

        expect(pixlerResult.isOk(), `${filename}: expected PixlerImage to create`).toBe(true);
        if (pixlerResult.isErr()) {
            throw new Error(`${filename} failed: ${pixlerResult.error}`);
        }

        const pixlerImg = pixlerResult.value;
        const widthResult = pixlerImg.width;
        const heightResult = pixlerImg.height;
        const centerPixelResult = pixlerImg.getPixel(1, 1);
        const topLeft = pixlerImg.getPixel(0, 0);
        const topRight = pixlerImg.getPixel(7, 0);
        const bottomLeft = pixlerImg.getPixel(0, 5);
        const bottomRight = pixlerImg.getPixel(7, 5);

        expect(centerPixelResult.isOk(), `${filename}: expected getPixel(1, 1) to succeed`).toBe(true);
        expect(topLeft.isOk(), `${filename}: expected getPixel(0, 0) to succeed`).toBe(true);
        expect(topRight.isOk(), `${filename}: expected getPixel(7, 0) to succeed`).toBe(true);
        expect(bottomLeft.isOk(), `${filename}: expected getPixel(0, 5) to succeed`).toBe(true);
        expect(bottomRight.isOk(), `${filename}: expected getPixel(7, 5) to succeed`).toBe(true);

        if (
            centerPixelResult.isErr() ||
            topLeft.isErr() ||
            topRight.isErr() ||
            bottomLeft.isErr() ||
            bottomRight.isErr()
        ) {
            throw new Error(`${filename}: unexpected PixlerImage error`);
        }

        expect(widthResult).toBe(8);
        expect(heightResult).toBe(6);
        expect(centerPixelResult.value).toEqual([235, 157, 52, 255]);
        expect(topLeft.value).toEqual([74, 112, 160, 255]);
        expect(topRight.value).toEqual([210, 130, 175, 255]);
        expect(bottomLeft.value).toEqual([74, 112, 160, 255]);
        expect(bottomRight.value).toEqual([210, 130, 175, 255]);
    });

    it('returns out-of-bounds errors for invalid PixlerImage getPixel coordinates', async () => {
        const filename = 'generated-mixed-run-length-grid-24.png';
        const filePath = join(assetDir, filename);
        const img = await read(filePath);
        const pixlerResult = await PixlerImg.createFromImage(img);

        expect(pixlerResult.isOk(), `${filename}: expected PixlerImage to create`).toBe(true);
        if (pixlerResult.isErr()) {
            throw new Error(`${filename} failed: ${pixlerResult.error}`);
        }

        const pixlerImg = pixlerResult.value;
        const invalidPixels = [
            [-1, 0],
            [0, -1],
            [8, 0],
            [0, 6],
            [8, 5],
            [7, 6],
        ];

        for (const [x, y] of invalidPixels) {
            const result = pixlerImg.getPixel(x, y);
            expect(result.isErr(), `${filename}: expected getPixel(${x}, ${y}) to fail`).toBe(true);
            expect(result.isErr() ? result.error : '').toContain('out of bounds');
        }
    });
});
