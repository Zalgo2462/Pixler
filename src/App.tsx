import { Application } from '@pixi/react';
import { formatHex, type Color } from 'culori';
import { useCallback, useRef, useState } from 'react';
import './App.css';
import { defaultAppState, type PixlerAppState } from './AppState';
import { PixlerImg } from './img';
import { COLOR_PALETTE } from './palettes/perler-palette';
import { PixlerPixiApp } from './PixlerPixiApp';

function App() {
    const [state, setState] = useState<PixlerAppState>(defaultAppState);

    const [beadMappingModalStatus, setBeadMappingModalStatus] = useState<'closed' | 'opening' | 'open'>('closed');

    const closeBeadMappingModalWithAnimation = () => {
        setBeadMappingModalStatus('opening');
        setTimeout(() => {
            setBeadMappingModalStatus('closed');
        }, 300);
    };

    const handleOpenBeadMappingModal = () => {
        setBeadMappingModalStatus('opening');
        requestAnimationFrame(() => {
            setTimeout(() => setBeadMappingModalStatus('open'), 10);
        });
    };
    const setError = useCallback((error: string) => {
        console.log('Error:', error);
        setState((current) => ({
            ...current,
            error,
        }));
    }, []);
    const setSelectedColorName = useCallback((name: string) => {
        setState((current) => ({
            ...current,
            selectedColorName: name,
        }));
    }, []);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            setError(`handleFileChange: failed to load file: {event.target.files?.[0]}`);
            return;
        }

        const imgResult = await PixlerImg.create(file);
        if (imgResult.isErr()) {
            setError(imgResult.error);
            return;
        }

        const img = imgResult.value;

        const paletteMappingResult = img.getDefaultPaletteMapping(COLOR_PALETTE);
        if (paletteMappingResult.isErr()) {
            setError(paletteMappingResult.error);
            return;
        }

        setState((current) => ({
            ...current,
            fileName: file.name,
            error: undefined,
            pixlerImg: imgResult.value,
            paletteMapping: paletteMappingResult.value,
            selectedColorName: '',
        }));
    };

    const handleColorMappingChange = (inputColor: Color, newOutputColorName: string) => {
        if (!state.paletteMapping) return;

        const updateResult = state.paletteMapping.updateMapping(inputColor, newOutputColorName, COLOR_PALETTE);

        if (updateResult.isErr()) {
            setError(updateResult.error);
            return;
        }

        setState((current) => ({
            ...current,
            paletteMapping: updateResult.value,
        }));
    };

    const handleColorMappingReset = () => {
        if (!state.pixlerImg) return;

        const paletteMappingResult = state.pixlerImg.getDefaultPaletteMapping(COLOR_PALETTE);
        if (paletteMappingResult.isErr()) {
            setError(paletteMappingResult.error);
            return;
        }

        setState((current) => ({
            ...current,
            paletteMapping: paletteMappingResult.value,
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
                    <PixlerPixiApp state={state} setError={setError} setSelectedColorName={setSelectedColorName} />
                </Application>
            </section>

            <section className="selection-panel">
                {state.enableMapping ? (
                    <p>Selected: {state.selectedColorName ?? 'None'} </p>
                ) : (
                    <p>Map colors to see the selected bead color...</p>
                )}
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
                    <div className="color-panel">
                        <label htmlFor="background-color-input">Background</label>
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
                </div>
                <div className="grid-label">
                    <label htmlFor="show-grid-toggle">Show Grid</label>
                </div>
                <div className="grid-input-and-mapping-panel">
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
                    <button
                        id="bead-mapping-button"
                        className="bead-mapping-input"
                        type="button"
                        onClick={handleOpenBeadMappingModal}
                    >
                        Map Colors
                    </button>
                </div>
            </section>

            {beadMappingModalStatus !== 'closed' && (
                <div
                    className={`modal-overlay full-screen-overlay ${beadMappingModalStatus === 'open' ? 'visible' : ''}`}
                >
                    <div className="modal-content-box full-screen-content">
                        <header className="modal-header">
                            <div className="mapping-toolbar-toggle">
                                <label htmlFor="enable-mapping-checkbox" className="mapping-toolbar-toggle-label">
                                    <span>Enabled</span>
                                </label>
                                <input
                                    id="enable-mapping-checkbox"
                                    className="mapping-toolbar-checkbox"
                                    type="checkbox"
                                    checked={state.enableMapping}
                                    disabled={!state.pixlerImg}
                                    onChange={(e) => {
                                        console.log('setting enable mapping: ', e.target.checked);
                                        setState((current) => ({
                                            ...current,
                                            enableMapping: e.target.checked,
                                        }));
                                    }}
                                />
                            </div>
                            <div className="mapping-toolbar-buttons">
                                <button
                                    className="mapping-toolbar-button"
                                    onClick={handleColorMappingReset}
                                    disabled={!state.pixlerImg}
                                >
                                    Reset
                                </button>
                                <button className="mapping-toolbar-button" onClick={closeBeadMappingModalWithAnimation}>
                                    Close
                                </button>
                            </div>
                        </header>
                        <div className="modal-body">
                            {state.paletteMapping ? (
                                <>
                                    <div className="color-mapping-grid">
                                        {state.paletteMapping.getInputColors().map((inputColor) => {
                                            const inputHex = formatHex(inputColor) ?? '#000000';
                                            const currentOutputHex =
                                                state.paletteMapping!.mapHexColorToOutputHexColor(inputHex);
                                            const currentOutputName =
                                                state.paletteMapping!.mapHexColorToOutputName(inputHex);

                                            return (
                                                <div key={inputHex} className="color-mapping-card">
                                                    <div
                                                        className="color-swatch-preview"
                                                        style={{ backgroundColor: inputHex }}
                                                    />
                                                    <span className="mapping-arrow">➡️</span>
                                                    <div
                                                        className="color-swatch-preview"
                                                        style={{ backgroundColor: currentOutputHex }}
                                                    />
                                                    <select
                                                        value={currentOutputName}
                                                        onChange={(e) =>
                                                            handleColorMappingChange(inputColor, e.target.value)
                                                        }
                                                        className="bead-selector-dropdown"
                                                    >
                                                        {Object.keys(COLOR_PALETTE).map((beadName) => (
                                                            <option key={beadName} value={beadName}>
                                                                {beadName}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="zero-state-container">
                                    <div className="zero-state-card">
                                        <span className="zero-state-icon">🖼️</span>
                                        <h3>No Image Loaded</h3>
                                        <p>
                                            Please close this view and upload an image first before mapping your Perler
                                            bead colors.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

export default App;
