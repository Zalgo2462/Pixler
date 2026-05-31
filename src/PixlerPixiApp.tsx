import { useApplication } from '@pixi/react';
import { formatHex } from 'culori/require';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';
import { Viewport } from 'pixi-viewport';
import { Application, Container, FederatedPointerEvent, Graphics } from 'pixi.js';
import { useEffect, useMemo, useRef } from 'react';
import type { PixlerAppState } from './AppState';
import { channelsMatch, channelsToColor, PaletteMapping } from './colors';
import { type ContentBounds, type PixlerImg } from './img';

const PIXEL_SCALE = 5; //number of screen pixels to draw per image pixel

interface Destroyable {
    destroy: () => void;
}

type DestroyableRegistry = Record<string, Destroyable>;

interface DrawError {
    toDestroy: Destroyable[];
    message: string;
}

const drawImage = (
    app: Application,
    state: PixlerAppState,
    viewport: Viewport,
    mainContainer: Container,
    destroyableRefs: DestroyableRegistry,
    destroyableKeysInUse: Set<string>,
): Result<void, DrawError> => {
    if (!state.pixlerImg || !state.paletteMapping) {
        return ok();
    }

    const imgBounds = determineCenteredImageContentBounds(state.pixlerImg);

    const drawnImgKey = 'drawnImg';
    let drawnImg = destroyableRefs[drawnImgKey] as Graphics | undefined;
    if (!drawnImg) {
        const drawnImgResult = drawPixlerImg(state.pixlerImg, state.paletteMapping, state.enableMapping, PIXEL_SCALE);
        if (drawnImgResult.isErr()) {
            return err({
                toDestroy: [drawnImgResult.error.toDestroy].flat(),
                message: drawnImgResult.error.message,
            });
        }
        drawnImg = drawnImgResult.value;
        destroyableRefs[drawnImgKey] = drawnImg;
        destroyableKeysInUse.add(drawnImgKey);
    }

    viewport.plugins.remove('clamp');
    viewport.plugins.remove('clamp-zoom');

    viewport.resize(app.screen.width, app.screen.height, imgBounds.width, imgBounds.height);

    const xZoomScale = app.screen.width / imgBounds.width;
    const yZoomScale = app.screen.height / imgBounds.height;
    const minZoomScale = Math.min(xZoomScale, yZoomScale);
    viewport.setZoom(minZoomScale, true);

    const imgCenterX = imgBounds.left + imgBounds.width / 2;
    const imgCenterY = imgBounds.top + imgBounds.height / 2;
    viewport.moveCenter(imgCenterX, imgCenterY);

    const screenWidthInWorldPixels = app.screen.width / minZoomScale;
    const screenHeightInWorldPixels = app.screen.height / minZoomScale;

    const horizontalBlankSpace = Math.max(0, (screenWidthInWorldPixels - imgBounds.width) / 2);
    const verticalBlankSpace = Math.max(0, (screenHeightInWorldPixels - imgBounds.height) / 2);
    const clampOptions = {
        left: imgBounds.left - imgBounds.width / 2 - horizontalBlankSpace,
        right: imgBounds.right + imgBounds.width / 2 + horizontalBlankSpace,
        top: imgBounds.top - imgBounds.height / 2 - verticalBlankSpace,
        bottom: imgBounds.bottom + imgBounds.height / 2 + verticalBlankSpace,
        underflow: 'none',
    };
    viewport.clamp(clampOptions);
    viewport.clampZoom({
        minScale: minZoomScale,
    });

    const borderGraphicsKey = 'borderGraphics';
    let borderGraphics = destroyableRefs[borderGraphicsKey] as Graphics | undefined;
    if (!borderGraphics) {
        borderGraphics = new Graphics();
        borderGraphics.strokeStyle = {
            width: 1,
            color: 0x000000,
            cap: 'square',
        };
        borderGraphics.rect(imgBounds.left, imgBounds.top, imgBounds.width, imgBounds.height);
        borderGraphics.stroke();
        borderGraphics.zIndex = 100;
        destroyableRefs[borderGraphicsKey] = borderGraphics;
        mainContainer.addChild(borderGraphics);
        destroyableKeysInUse.add(borderGraphicsKey);
    }

    mainContainer.addChild(drawnImg);
    return ok();
};

const drawGrid = (
    _app: Application,
    state: PixlerAppState,
    _viewport: Viewport,
    mainContainer: Container,
    destroyableRefs: DestroyableRegistry,
    destroyableKeysInUse: Set<string>,
): Result<void, DrawError> => {
    if (!state.pixlerImg) {
        return ok();
    }
    const imgBounds = determineCenteredImageContentBounds(state.pixlerImg);

    const gridGraphicsKey = 'gridGraphics';
    let gridGraphics = destroyableRefs[gridGraphicsKey] as Graphics | undefined;
    if (!gridGraphics) {
        gridGraphics = new Graphics();
        gridGraphics.strokeStyle = {
            width: 1,
            color: state.gridColor,
            cap: 'square',
        };
        for (let x = imgBounds.left; x <= imgBounds.right; x += PIXEL_SCALE) {
            gridGraphics.moveTo(x, imgBounds.top);
            gridGraphics.lineTo(x, imgBounds.bottom);
        }
        for (let y = imgBounds.top; y <= imgBounds.bottom; y += PIXEL_SCALE) {
            gridGraphics.moveTo(imgBounds.left, y);
            gridGraphics.lineTo(imgBounds.right, y);
        }
        gridGraphics.stroke();
        destroyableRefs[gridGraphicsKey] = gridGraphics;
        destroyableKeysInUse.add(gridGraphicsKey);
        mainContainer.addChild(gridGraphics);
    }
    gridGraphics.visible = state.showGrid;
    return ok();
};

const determineCenteredImageContentBounds = (img: PixlerImg): ContentBounds => {
    const drawnImageWidth = img.width * PIXEL_SCALE;
    const drawnImageHeight = img.height * PIXEL_SCALE;
    return {
        left: 0,
        right: drawnImageWidth,
        top: 0,
        bottom: drawnImageHeight,
        width: drawnImageWidth,
        height: drawnImageHeight,
    };
};

const drawCursorOnEvent = (
    e: FederatedPointerEvent,
    _app: Application,
    state: PixlerAppState,
    viewport: Viewport,
    mainContainer: Container,
    destroyableRefs: DestroyableRegistry,
    destroyableKeysInUse: Set<string>,
): Result<void, DrawError> => {
    if (!state.pixlerImg) {
        return ok();
    }

    const imgContentBounds = determineCenteredImageContentBounds(state.pixlerImg);

    const cursorCrosshairKey = 'cursorCrosshair';
    let cursorCrosshair = destroyableRefs[cursorCrosshairKey] as Graphics | undefined;
    if (!cursorCrosshair) {
        cursorCrosshair = drawCursorCrosshair(PIXEL_SCALE, state.cursorColor);
        cursorCrosshair.zIndex = 1000; // ensure crosshair is on top
        mainContainer.addChild(cursorCrosshair);
        destroyableRefs[cursorCrosshairKey] = cursorCrosshair;
        destroyableKeysInUse.add(cursorCrosshairKey);
    }
    const localPos = viewport.toLocal(e.global);
    localPos.x = Math.floor(localPos.x / PIXEL_SCALE) * PIXEL_SCALE;
    localPos.y = Math.floor(localPos.y / PIXEL_SCALE) * PIXEL_SCALE;
    cursorCrosshair.position.set(localPos.x, localPos.y);
    if (
        localPos.x < imgContentBounds.left ||
        localPos.x >= imgContentBounds.right ||
        localPos.y < imgContentBounds.top ||
        localPos.y >= imgContentBounds.bottom
    ) {
        cursorCrosshair.visible = false;
    } else {
        cursorCrosshair.visible = true;
    }
    return ok();
};

const handleSetSelectedColorName = (
    e: FederatedPointerEvent,
    state: PixlerAppState,
    viewport: Viewport,
    setSelectedColorName: (name: string) => void,
): Result<void, string> => {
    if (!state.pixlerImg || !state.paletteMapping || !state.enableMapping) {
        return ok();
    }

    const imgContentBounds = determineCenteredImageContentBounds(state.pixlerImg);
    const localPos = viewport.toLocal(e.global);
    localPos.x = Math.floor(localPos.x / PIXEL_SCALE) * PIXEL_SCALE;
    localPos.y = Math.floor(localPos.y / PIXEL_SCALE) * PIXEL_SCALE;
    if (
        localPos.x < imgContentBounds.left ||
        localPos.x >= imgContentBounds.right ||
        localPos.y < imgContentBounds.top ||
        localPos.y >= imgContentBounds.bottom
    ) {
        setSelectedColorName('');
        return ok();
    }

    const imgPosX = (localPos.x - imgContentBounds.left) / PIXEL_SCALE;
    const imgPosY = (localPos.y - imgContentBounds.top) / PIXEL_SCALE;
    const imgChannelsResult = state.pixlerImg.getPixel(imgPosX, imgPosY);
    if (imgChannelsResult.isErr()) {
        return err(imgChannelsResult.error);
    }
    const imgChannels = imgChannelsResult.value;
    const imgColorResult = channelsToColor(imgChannels);
    if (imgColorResult.isErr()) {
        return err(imgColorResult.error);
    }
    const imgColor = imgColorResult.value;
    const imgColorHex = formatHex(imgColor);
    const outputColorHex = state.paletteMapping.mapHexColorToOutputHexColor(imgColorHex);
    const outputColorName = state.paletteMapping.getNameForOutputColor(outputColorHex);
    setSelectedColorName(outputColorName);
    return ok();
};

const drawPixlerImg = (
    img: PixlerImg,
    paletteMapping: PaletteMapping,
    enableMapping: boolean,
    scale: number,
): Result<Graphics, DrawError> => {
    const graphics = new Graphics();
    for (let y = 0; y < img.height; y += 1) {
        for (let x = 0; x < img.width; x += 1) {
            const pixelResult = img.getPixel(x, y);
            if (pixelResult.isErr()) {
                return err({
                    toDestroy: [graphics],
                    message: `Error getting pixel at (${x}, ${y}): ${pixelResult.error}`,
                });
            }
            let channels = pixelResult.value;
            if (channelsMatch(channels, img.backgroundColor)) {
                channels = [0, 0, 0, 0];
            }
            const [r, g, b, a] = pixelResult.value;
            let color = (r << 16) | (g << 8) | b;

            if (enableMapping && color != 0) {
                color = paletteMapping.mapPixiColor(color);
            }

            graphics.rect(x * scale, y * scale, scale, scale);
            graphics.fill({ color, alpha: a / 255 });
        }
    }
    return ok(graphics);
};

const drawCursorCrosshair = (scale: number, color: string): Graphics => {
    const graphics = new Graphics();
    graphics.strokeStyle = {
        width: 1,
        color: color,
        cap: 'square',
    };
    // stroke a square crosshair with a gap in the middle, sized to the grid scale
    graphics.moveTo(0, 0);
    graphics.lineTo((1 / 5) * scale, 0);
    graphics.moveTo((4 / 5) * scale, 0);
    graphics.lineTo(scale, 0);

    graphics.moveTo(0, 0);
    graphics.lineTo(0, (1 / 5) * scale);
    graphics.moveTo(0, (4 / 5) * scale);
    graphics.lineTo(0, scale);

    graphics.moveTo(scale, 0);
    graphics.lineTo(scale, (1 / 5) * scale);
    graphics.moveTo(scale, (4 / 5) * scale);
    graphics.lineTo(scale, scale);

    graphics.moveTo(0, scale);
    graphics.lineTo((1 / 5) * scale, scale);
    graphics.moveTo((4 / 5) * scale, scale);
    graphics.lineTo(scale, scale);

    graphics.stroke();
    return graphics;
};

export const PixlerPixiApp = (props: {
    state: PixlerAppState;
    setError: (error: string) => void;
    setSelectedColorName: (name: string) => void;
}) => {
    const { app, isInitialised } = useApplication();
    const destroyableRegistry = useRef<DestroyableRegistry>({});
    const drawImageDestoyableKeys = useRef<Set<string>>(new Set<string>());
    const drawTogglesDestoyableKeys = useRef<Set<string>>(new Set<string>());
    const pointerEventsDestroyableKeys = useRef<Set<string>>(new Set<string>());

    const { viewport, mainContainer } = useMemo(() => {
        if (!isInitialised || !app || !app.renderer) {
            return {
                viewport: null,
                mainContainer: null,
            };
        }
        const viewport = new Viewport({
            events: app.renderer.events,
            ticker: app.ticker,
            screenWidth: app.screen.width,
            screenHeight: app.screen.height,
            worldWidth: app.screen.width,
            worldHeight: app.screen.height,
        });
        viewport.drag();
        viewport.pinch();
        viewport.wheel();
        viewport.eventMode = 'static';

        const mainContainer = new Container();
        return { viewport, mainContainer };
    }, [app, isInitialised]);

    useEffect(() => {
        if (!isInitialised || !app || !app.renderer) {
            return;
        }
        app.renderer.background.color = props.state.backgroundColor;
    }, [app, isInitialised, props.state.backgroundColor]);

    useEffect(() => {
        if (!isInitialised || !app || !app.renderer || !viewport || !mainContainer) {
            return;
        }
        app.stage.addChild(viewport);
        viewport.addChild(mainContainer);
        return () => {
            if (viewport.parent) {
                viewport.parent.removeChild(viewport);
            }
            viewport.destroy();
        };
    }, [app, isInitialised, viewport, mainContainer]);

    useEffect(() => {
        if (!isInitialised || !app || !app.renderer || !viewport) {
            return;
        }
        viewport.resize(app.screen.width, app.screen.height);
    }, [app, isInitialised, viewport]);

    useEffect(() => {
        if (!isInitialised || !app || !app.renderer || !mainContainer) {
            return;
        }
        const toDestroyResult = drawImage(
            app,
            props.state,
            viewport,
            mainContainer,
            destroyableRegistry.current,
            drawImageDestoyableKeys.current,
        );
        if (toDestroyResult.isErr()) {
            const { toDestroy, message } = toDestroyResult.error;
            for (const obj of toDestroy) {
                obj.destroy();
            }
            props.setError(message);
            return;
        }
        return () => {
            for (const key of drawImageDestoyableKeys.current) {
                destroyableRegistry.current[key].destroy();
                delete destroyableRegistry.current[key];
            }
            drawImageDestoyableKeys.current.clear();
        };
    }, [
        app,
        isInitialised,
        props.state.pixlerImg,
        props.state.paletteMapping,
        props.state.enableMapping,
        props.setError,
        mainContainer,
    ]);

    useEffect(() => {
        if (!isInitialised || !mainContainer) {
            return;
        }
        const toDestroyResult = drawGrid(
            app,
            props.state,
            viewport,
            mainContainer,
            destroyableRegistry.current,
            drawTogglesDestoyableKeys.current,
        );
        if (toDestroyResult.isErr()) {
            const { toDestroy, message } = toDestroyResult.error;
            for (const obj of toDestroy) {
                obj.destroy();
            }
            props.setError(message);
            return;
        }
        return () => {
            for (const key of drawTogglesDestoyableKeys.current) {
                destroyableRegistry.current[key].destroy();
                delete destroyableRegistry.current[key];
            }
            drawTogglesDestoyableKeys.current.clear();
        };
    }, [
        app,
        isInitialised,
        props.state.pixlerImg,
        props.state.showGrid,
        props.state.gridColor,
        props.setError,
        mainContainer,
    ]);

    useEffect(() => {
        if (!isInitialised || !viewport || !mainContainer) {
            return;
        }
        const pointerTapHandler = (e: FederatedPointerEvent) => {
            const drawResult = drawCursorOnEvent(
                e,
                app,
                props.state,
                viewport,
                mainContainer,
                destroyableRegistry.current,
                pointerEventsDestroyableKeys.current,
            );
            handleSetSelectedColorName(e, props.state, viewport, props.setSelectedColorName);
            if (drawResult.isErr()) {
                const { toDestroy, message } = drawResult.error;
                for (const obj of toDestroy) {
                    obj.destroy();
                }
                props.setError(message);
                return;
            }
        };
        viewport.on('pointertap', pointerTapHandler);
        const pointerMoveHandler = (e: FederatedPointerEvent) => {
            const drawResult = drawCursorOnEvent(
                e,
                app,
                props.state,
                viewport,
                mainContainer,
                destroyableRegistry.current,
                pointerEventsDestroyableKeys.current,
            );
            handleSetSelectedColorName(e, props.state, viewport, props.setSelectedColorName);
            if (drawResult.isErr()) {
                const { toDestroy, message } = drawResult.error;
                for (const obj of toDestroy) {
                    obj.destroy();
                }
                props.setError(message);
                return;
            }
        };
        viewport.on('pointermove', pointerMoveHandler);
        return () => {
            viewport.off('pointertap', pointerTapHandler);
            viewport.off('pointermove', pointerMoveHandler);
            for (const key of pointerEventsDestroyableKeys.current) {
                destroyableRegistry.current[key]?.destroy();
                delete destroyableRegistry.current[key];
            }
            pointerEventsDestroyableKeys.current.clear();
        };
    }, [
        app,
        isInitialised,
        props.state.pixlerImg,
        props.state.cursorColor,
        props.state.paletteMapping,
        props.state.enableMapping,
        props.setError,
        props.setSelectedColorName,
        mainContainer,
        viewport,
    ]);

    return null;
};
