import { useApplication } from '@pixi/react';
import { useEffect, useMemo } from 'react';
import { Graphics } from 'pixi.js';
import { Viewport as PixiViewport } from 'pixi-viewport';

export interface ViewportProps {
    screenWidth: number;
    screenHeight: number;
    worldWidth: number;
    worldHeight: number;
    drag?: boolean;
    pinch?: boolean;
    wheel?: boolean;
    clampZoom?: { minScale: number; maxScale: number };
    draw?: (graphics: Graphics) => void;
}

export default function Viewport(props: ViewportProps) {
    const { app } = useApplication();

    const viewport = useMemo(() => {
        const viewportInstance = new PixiViewport({
            screenWidth: props.screenWidth,
            screenHeight: props.screenHeight,
            worldWidth: props.worldWidth,
            worldHeight: props.worldHeight,
            ticker: app.ticker,
            events: app.renderer.events,
        });

        if (props.drag) viewportInstance.drag();
        if (props.pinch) viewportInstance.pinch();
        if (props.wheel) viewportInstance.wheel();
        if (props.clampZoom) viewportInstance.clampZoom(props.clampZoom);

        return viewportInstance;
    }, [app]);

    const graphics = useMemo(() => new Graphics(), []);

    useEffect(() => {
        app.stage.addChild(viewport);
        viewport.addChild(graphics);

        return () => {
            if (viewport.parent) {
                viewport.parent.removeChild(viewport);
            }
            graphics.destroy();
            viewport.destroy();
        };
    }, [app, viewport, graphics]);

    useEffect(() => {
        viewport.resize(
            props.screenWidth,
            props.screenHeight,
            props.worldWidth,
            props.worldHeight,
        );
    }, [
        viewport,
        props.screenWidth,
        props.screenHeight,
        props.worldWidth,
        props.worldHeight,
    ]);

    useEffect(() => {
        if (!props.draw) return;
        props.draw(graphics);
    }, [graphics, props.draw]);

    return null;
}
