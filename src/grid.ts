import { Image } from 'image-js';
import { err, ok, type Result } from 'neverthrow';
import { channelsMatch } from './colors';

export interface PixelArtGrid {
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
}

export function pixelArtGridFromImage(img: Image): Result<PixelArtGrid, string> {
    const maxSearchDepth = 4; // depth = 4 results in checking at most 16 rows/ columns for run lengths
    const horizontalRunLengthsResult = searchForHorizontalRunLengths(img, maxSearchDepth);
    if (horizontalRunLengthsResult.isErr()) {
        return err(horizontalRunLengthsResult.error);
    }
    const verticalRunLengthsResult = searchForVerticalRunLengths(img, maxSearchDepth);
    if (verticalRunLengthsResult.isErr()) {
        return err(verticalRunLengthsResult.error);
    }
    const scaleXResult = getScaleFromRunLengths(horizontalRunLengthsResult.value);
    if (scaleXResult.isErr()) {
        return err(scaleXResult.error);
    }
    const scaleYResult = getScaleFromRunLengths(verticalRunLengthsResult.value);
    if (scaleYResult.isErr()) {
        return err(scaleYResult.error);
    }
    const offsetXResult = horizontalRunLengthsResult.value[0] % scaleXResult.value;
    const offsetYResult = verticalRunLengthsResult.value[0] % scaleYResult.value;
    return ok({
        scaleX: scaleXResult.value,
        scaleY: scaleYResult.value,
        offsetX: offsetXResult,
        offsetY: offsetYResult,
    });
}

function searchForHorizontalRunLengths(img: Image, maxDepth: number): Result<number[], string> {
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
        return err('searchForHorizontalRunLengths: could not find sample row with enough content');
    }
    if (currDepth > maxDepth) {
        return err('searchForHorizontalRunLengths: could not find sample row with enough content');
    }

    const midY = Math.floor((startY + endY) / 2);
    const runLengths = horizontalRunLengths(img, midY);
    if (runLengths.length >= 3) {
        // <pad> <content> <pad>
        return ok(runLengths);
    }
    if (endY - startY === 1) {
        return err('searchForHorizontalRunLengths: could not find sample row with enough content');
    }

    const leftRuns = searchForHorizontalRunLengthsHelper(img, startY, midY, currDepth + 1, maxDepth);
    if (leftRuns.isOk()) {
        return leftRuns;
    }

    const rightRuns = searchForHorizontalRunLengthsHelper(img, midY + 1, endY, currDepth + 1, maxDepth);
    if (rightRuns.isOk()) {
        return rightRuns;
    }

    // return the error value up from either left or right since they're the same error
    return leftRuns;
}

function searchForVerticalRunLengths(img: Image, maxDepth: number): Result<number[], string> {
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
        return err('searchForVerticalRunLengths: could not find sample column with enough content');
    }
    if (currDepth > maxDepth) {
        return err('searchForVerticalRunLengths: could not find sample column with enough content');
    }

    const midX = Math.floor((startX + endX) / 2);
    const runLengths = verticalRunLengths(img, midX);
    if (runLengths.length >= 3) {
        // <pad> <content> <pad>
        return ok(runLengths);
    }
    if (endX - startX === 1) {
        return err('searchForVerticalRunLengths: could not find sample column with enough content');
    }

    const leftRuns = searchForVerticalRunLengthsHelper(img, startX, midX, currDepth + 1, maxDepth);
    if (leftRuns.isOk()) {
        return leftRuns;
    }

    const rightRuns = searchForVerticalRunLengthsHelper(img, midX + 1, endX, currDepth + 1, maxDepth);
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
        if (channelsMatch(currPixelValue, nextPixelValue)) {
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
        if (channelsMatch(currPixelValue, nextPixelValue)) {
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

function getScaleFromRunLengths(runLengths: number[]): Result<number, string> {
    if (runLengths.length < 3) {
        return err('getScaleFromRunLengths: invalid run length count');
    }
    return ok(runLengths.slice(1, -1).reduce(gcd));
}

function gcd(a: number, b: number): number {
    if (b === 0) {
        return a;
    }
    return gcd(b, a % b);
}
