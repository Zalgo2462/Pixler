import { Application } from '@pixi/react';
import { useCallback, useRef, useState } from 'react';
import './App.css';
import { defaultAppState, type PixlerAppState } from './AppState';
import { PixlerImg } from './img';
import { PixlerPixiApp } from './PixlerPixiApp';

function App() {
    const [state, setState] = useState<PixlerAppState>(defaultAppState);

    const setError = useCallback((error: string) => {
        console.log('Error:', error);
        setState((current) => ({
            ...current,
            error,
        }));
    }, []);

    const handleFileChange = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = event.target.files?.[0];
        if (!file) {
            setState((current) => ({
                ...current,
                fileName: null,
                error: null,
                pixlerImg: null,
            }));
            return;
        }

        const result = await PixlerImg.create(file);
        if (result.isErr()) {
            setState({
                ...defaultAppState,
                fileName: file.name,
                error: result.error,
            });
            return;
        }

        setState((current) => ({
            ...current,
            fileName: file.name,
            error: null,
            pixlerImg: result.value,
        }));
    };

    const pixiContainerRef = useRef<HTMLDivElement>(null);

    return (
        <main className="app">
            <section className="canvas-panel" ref={pixiContainerRef}>
                <Application
                    backgroundColor={0xffffff}
                    autoStart
                    sharedTicker
                    resizeTo={pixiContainerRef}
                    failIfMajorPerformanceCaveat={false}
                    powerPreference="high-performance"
                    premultipliedAlpha={true}
                >
                    <PixlerPixiApp state={state} setError={setError} />
                </Application>
            </section>

            <section className="ctrls-panel">
                <div className="upload-label">
                    <label>Upload</label>
                </div>
                <input
                    className="upload-input"
                    id="file-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                />
                <div className="colors-label">
                    <label> Colors </label>
                </div>
                <div className="colors-panel">
                    <div className="color-panel">
                        <label htmlFor="background-color-input">
                            Background
                        </label>
                        <input
                            id="background-color-input"
                            type="color"
                            value={state.backgroundColor}
                            onChange={(e) =>
                                setState((current) => ({
                                    ...current,
                                    backgroundColor: e.target.value,
                                }))
                            }
                        />
                    </div>
                    <div className="color-panel">
                        <label htmlFor="grid-color-input">Grid</label>
                        <input
                            id="grid-color-input"
                            type="color"
                            value={state.gridColor}
                            onChange={(e) =>
                                setState((current) => ({
                                    ...current,
                                    gridColor: e.target.value,
                                }))
                            }
                        />
                    </div>
                    <div className="color-panel">
                        <label htmlFor="cursor-color-input">Cursor</label>
                        <input
                            id="cursor-color-input"
                            type="color"
                            value={state.cursorColor}
                            onChange={(e) =>
                                setState((current) => ({
                                    ...current,
                                    cursorColor: e.target.value,
                                }))
                            }
                        />
                    </div>
                </div>
                <div className="grid-label">
                    <label htmlFor="show-grid-toggle">Show Grid</label>
                </div>
                <input
                    className="grid-input"
                    id="show-grid-toggle"
                    type="checkbox"
                    checked={state.showGrid}
                    onChange={(e) =>
                        setState((current) => ({
                            ...current,
                            showGrid: e.target.checked,
                        }))
                    }
                />
            </section>
        </main>
    );
}

export default App;
