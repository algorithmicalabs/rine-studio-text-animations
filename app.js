/* Rine Studio Text Animation Maker — Core Engine v4 (Scenes + Transitions + Mini-Timeline) */

document.addEventListener('DOMContentLoaded', () => {

    // ── DOM REFS ───────────────────────────────────────────────
    const textInput           = document.getElementById('text-input');
    const sliderFontSize      = document.getElementById('slider-font-size');
    const valFontSize         = document.getElementById('font-size-val');
    const sliderLetterSpacing = document.getElementById('slider-letter-spacing');
    const valLetterSpacing    = document.getElementById('letter-spacing-val');
    const sliderLineHeight    = document.getElementById('slider-line-height');
    const valLineHeight       = document.getElementById('line-height-val');
    const sliderStart         = document.getElementById('slider-start-time');
    const valStart            = document.getElementById('start-time-val');
    const sliderIn            = document.getElementById('slider-in-duration');
    const valIn               = document.getElementById('in-duration-val');
    const sliderHold          = document.getElementById('slider-hold-duration');
    const valHold             = document.getElementById('hold-duration-val');
    const sliderOut           = document.getElementById('slider-out-duration');
    const valOut              = document.getElementById('out-duration-val');
    const sliderStagger       = document.getElementById('slider-stagger');
    const valStagger          = document.getElementById('stagger-val');
    const btnPlayPause        = document.getElementById('btn-play-pause');
    const btnStop             = document.getElementById('btn-stop');
    const btnRecord           = document.getElementById('btn-record');
    const playIcon            = document.getElementById('play-icon');
    const timelineScrubber    = document.getElementById('timeline-scrubber');
    const readoutCurrent      = document.getElementById('current-frame-readout');
    const readoutTotal        = document.getElementById('total-duration-readout');
    const ticksContainer      = document.getElementById('timeline-ticks');
    let canvas              = document.getElementById('text-canvas');
    const canvasContainer     = document.getElementById('canvas-container');
    const canvasGridOverlay   = document.getElementById('canvas-grid-overlay');
    const btnToggleGrid       = document.getElementById('btn-toggle-grid');
    const systemDot           = document.getElementById('system-dot');
    const statusText          = document.getElementById('status-text');
    const customCursor        = document.getElementById('custom-cursor');
    const exportModal         = document.getElementById('export-modal');
    const exportVideoPreview  = document.getElementById('export-video-preview');
    const btnCloseModal       = document.getElementById('btn-close-modal');
    const btnDownloadVideo    = document.getElementById('btn-download-video');
    const toastMessage        = document.getElementById('toast-message');
    const sliderPosX          = document.getElementById('slider-pos-x');
    const valPosX             = document.getElementById('pos-x-val');
    const sliderPosY          = document.getElementById('slider-pos-y');
    const valPosY             = document.getElementById('pos-y-val');
    const layerListEl         = document.getElementById('layer-list');
    const btnAddLayer         = document.getElementById('btn-add-layer');
    const btnDeleteLayer      = document.getElementById('btn-delete-layer');
    const selectIn            = document.getElementById('select-in-preset');
    const selectOut           = document.getElementById('select-out-preset');
    const sceneListEl         = document.getElementById('scene-list');
    const btnAddScene         = document.getElementById('btn-add-scene');
    const btnDeleteScene      = document.getElementById('btn-delete-scene');
    const btnPlayAll          = document.getElementById('btn-play-all');

    let ctx = canvas.getContext('2d');

    // ── LAYER DATA MODEL ──────────────────────────────────────
    let layerCounter = 1;
    function createLayer(overrides = {}) {
        return {
            id: `layer-${Date.now()}-${layerCounter}`,
            name: `Layer ${layerCounter++}`,
            visible: true,
            text: 'Rine Studio',
            fontSize: 60,
            letterSpacing: -2,
            lineHeight: 11,
            textAlign: 'center',
            textColor: '#000000',
            posX: 50,
            posY: 50,
            startTime: 0.0,
            inDuration: 1.5,
            holdDuration: 1.0,
            outDuration: 1.0,
            inPreset: 'blueprint',
            outPreset: 'blueprint',
            staggerMs: 100,
            ...overrides,
        };
    }

    // ── SCENE DATA MODEL ──────────────────────────────────────
    let sceneCounter = 1;
    function createScene(overrides = {}) {
        return {
            id: `scene-${Date.now()}-${sceneCounter}`,
            name: `Scene ${sceneCounter++}`,
            background: '#F9F9F9',
            layers: [createLayer()],
            ...overrides,
        };
    }

    // ── TRANSITION DATA MODEL ─────────────────────────────────
    const TRANSITION_TYPES = [
        { key: 'cut',        label: '✂ Hard Cut'       },
        { key: 'crossfade',  label: '◐ Cross-Fade'     },
        { key: 'flash',      label: '⚡ Flash/Flare'    },
        { key: 'wipe-right', label: '▶ Wipe Right'     },
        { key: 'wipe-up',    label: '▲ Wipe Up'        },
        { key: 'zoom-through',label: '⊙ Zoom Through'  },
        { key: 'glitch',     label: '📺 Glitch'         },
        { key: 'scan-line',  label: '🔬 Blueprint Scan' },
        { key: 'scatter',    label: '⬡ Pixel Scatter'  },
    ];

    function createTransition(overrides = {}) {
        return { type: 'crossfade', duration: 0.4, ...overrides };
    }

    // ── GLOBAL STATE ──────────────────────────────────────────
    let scenes         = [createScene()];
    let transitions    = [];          // always scenes.length - 1 entries
    let activeSceneIdx = 0;
    let activeLayerIdx = 0;

    let isPlaying       = false;
    let isPlayingAll    = false;
    let playAllSceneIdx = 0;
    let isInTransition  = false;
    let transitionTime  = 0;
    let currentTime     = 0;
    let lastTimestamp   = 0;
    let rafId           = null;

    let currentRatio = '16-9';
    let isRecording  = false;
    let mediaRecorder  = null;
    let recordedChunks = [];

    // ── HELPERS ───────────────────────────────────────────────
    function getActiveScene()  { return scenes[activeSceneIdx]; }
    function getActiveLayers() { return getActiveScene().layers; }
    function getActiveLayer()  { return getActiveLayers()[activeLayerIdx]; }

    // Keep transitions in sync with scenes
    function syncTransitionsArray() {
        const needed = scenes.length - 1;
        while (transitions.length < needed) transitions.push(createTransition());
        while (transitions.length > needed) transitions.pop();
    }
    syncTransitionsArray();

    // ── CANVAS RESOLUTION ─────────────────────────────────────
    const RESOLUTIONS = {
        '16-9': { w: 1920, h: 1080 },
        '9-16': { w: 1080, h: 1920 },
        '1-1':  { w: 1080, h: 1080 },
    };
    function applyResolution(ratio) {
        const { w, h } = RESOLUTIONS[ratio];
        canvas.width = w; canvas.height = h;
    }
    applyResolution(currentRatio);

    // ── DURATION HELPERS ──────────────────────────────────────

    // Natural duration = max layer endpoint
    function computeSceneDuration(scene) {
        let max = 0;
        scene.layers.forEach(l => {
            const end = l.startTime + l.inDuration + l.holdDuration + l.outDuration;
            if (end > max) max = end;
        });
        return Math.max(max, 0.1);
    }

    function computeTotalDuration() {
        const scenesTotal = scenes.reduce((s, sc) => s + computeSceneDuration(sc), 0);
        const transTotal  = transitions.reduce((s, t) => s + t.duration, 0);
        return scenesTotal + transTotal;
    }

    // ── CUSTOM CURSOR ─────────────────────────────────────────
    let mouseX = 0, mouseY = 0, curX = 0, curY = 0;
    window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
    (function animCursor() {
        curX += (mouseX - curX) * 0.18;
        curY += (mouseY - curY) * 0.18;
        customCursor.style.left = curX + 'px';
        customCursor.style.top  = curY + 'px';
        requestAnimationFrame(animCursor);
    })();

    function rebindCursorEvents() {
        document.querySelectorAll('[data-cursor]').forEach(el => {
            if (el._cursorBound) return;
            el._cursorBound = true;
            el.addEventListener('mouseenter', () => {
                const t = el.getAttribute('data-cursor');
                if (t === 'btn')      customCursor.className = 'hover-btn';
                if (t === 'slider')   customCursor.className = 'hover-slider';
                if (t === 'textarea') customCursor.className = 'hover-textarea';
                if (t === 'input')    customCursor.className = 'hover-input';
            });
            el.addEventListener('mouseleave', () => { customCursor.className = ''; });
        });
    }
    rebindCursorEvents();

    canvas.addEventListener('mouseenter', () => { if (!isDragging) customCursor.className = 'hover-canvas'; });
    canvas.addEventListener('mouseleave', () => { if (!isDragging) customCursor.className = ''; });

    // ── TOAST ─────────────────────────────────────────────────
    function showToast(msg) {
        toastMessage.textContent = msg;
        toastMessage.classList.add('active');
        setTimeout(() => toastMessage.classList.remove('active'), 2500);
    }

    // ── TIMELINE TICKS ────────────────────────────────────────
    function buildTicks() {
        ticksContainer.innerHTML = '';
        for (let i = 0; i <= 20; i++) {
            const t = document.createElement('div');
            t.className = 'timeline-tick' + (i % 5 === 0 ? ' major' : '');
            ticksContainer.appendChild(t);
        }
    }
    buildTicks();

    function syncTimeline() {
        const total = isPlayingAll ? computeTotalDuration() : computeSceneDuration(getActiveScene());
        let displayTime = currentTime;
        if (isPlayingAll) {
            let offset = 0;
            for (let i = 0; i < playAllSceneIdx; i++) {
                offset += computeSceneDuration(scenes[i]);
                if (transitions[i]) offset += transitions[i].duration;
            }
            if (isInTransition) offset += computeSceneDuration(scenes[playAllSceneIdx]);
            displayTime = offset + (isInTransition ? transitionTime : currentTime);
        }
        const pct = total > 0 ? (displayTime / total) * 100 : 0;
        timelineScrubber.value = Math.min(100, pct);
        readoutCurrent.textContent = displayTime.toFixed(1) + 's';
        readoutTotal.textContent   = total.toFixed(1) + 's';
    }

    // ── EASING ────────────────────────────────────────────────
    const ease = {
        outQuint:  x => 1 - Math.pow(1 - x, 5),
        outCubic:  x => 1 - Math.pow(1 - x, 3),
        outBack:   x => { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
        inOutCubic: x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
    };

    // ── LAYER UI ──────────────────────────────────────────────
    function renderLayerList() {
        layerListEl.innerHTML = '';
        const layers = getActiveLayers();
        layers.forEach((layer, idx) => {
            const row = document.createElement('div');
            row.className = 'layer-row' + (idx === activeLayerIdx ? ' active' : '');
            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = layer.name;
            const visBtn = document.createElement('button');
            visBtn.className = 'layer-vis-btn';
            visBtn.textContent = layer.visible ? '◎' : '○';
            visBtn.addEventListener('click', e => {
                e.stopPropagation();
                layer.visible = !layer.visible;
                visBtn.textContent = layer.visible ? '◎' : '○';
                draw(); refreshSceneThumbnails();
            });
            row.appendChild(nameSpan);
            row.appendChild(visBtn);
            row.addEventListener('click', () => {
                saveActiveLayerFromUI();
                activeLayerIdx = idx;
                loadLayerIntoUI(getActiveLayers()[activeLayerIdx]);
                renderLayerList();
                renderMiniTimeline(getActiveScene(), activeSceneIdx);
                draw();
            });
            layerListEl.appendChild(row);
        });
    }

    function saveActiveLayerFromUI() {
        const layer = getActiveLayer();
        if (!layer) return;
        layer.text          = textInput.value;
        layer.fontSize      = parseInt(sliderFontSize.value);
        layer.letterSpacing = parseInt(sliderLetterSpacing.value);
        layer.lineHeight    = parseInt(sliderLineHeight.value);
        layer.posX          = parseInt(sliderPosX.value);
        layer.posY          = parseInt(sliderPosY.value);
        layer.startTime     = parseInt(sliderStart.value) / 10;
        layer.inDuration    = parseInt(sliderIn.value) / 10;
        layer.holdDuration  = parseInt(sliderHold.value) / 10;
        layer.outDuration   = parseInt(sliderOut.value) / 10;
        layer.staggerMs     = parseInt(sliderStagger.value);
        layer.inPreset      = selectIn.value;
        layer.outPreset     = selectOut.value;
    }

    function loadLayerIntoUI(layer) {
        textInput.value = layer.text;
        sliderFontSize.value = layer.fontSize;
        valFontSize.textContent = layer.fontSize + 'px';
        sliderLetterSpacing.value = layer.letterSpacing;
        valLetterSpacing.textContent = (layer.letterSpacing / 100).toFixed(2) + 'em';
        sliderLineHeight.value = layer.lineHeight;
        valLineHeight.textContent = (layer.lineHeight / 10).toFixed(1) + 'x';
        sliderPosX.value = layer.posX;
        valPosX.textContent = layer.posX + '%';
        sliderPosY.value = layer.posY;
        valPosY.textContent = layer.posY + '%';
        sliderStart.value = Math.round(layer.startTime * 10);
        valStart.textContent = layer.startTime.toFixed(1) + 's';
        sliderIn.value = Math.round(layer.inDuration * 10);
        valIn.textContent = layer.inDuration.toFixed(1) + 's';
        sliderHold.value = Math.round(layer.holdDuration * 10);
        valHold.textContent = layer.holdDuration.toFixed(1) + 's';
        sliderOut.value = Math.round(layer.outDuration * 10);
        valOut.textContent = layer.outDuration.toFixed(1) + 's';
        sliderStagger.value = layer.staggerMs;
        valStagger.textContent = layer.staggerMs + 'ms';
        selectIn.value  = layer.inPreset;
        selectOut.value = layer.outPreset;
        document.querySelectorAll('[data-align]').forEach(b => b.classList.toggle('active', b.getAttribute('data-align') === layer.textAlign));
        document.querySelectorAll('.swatch-row [data-color]').forEach(b => b.classList.toggle('active', b.getAttribute('data-color') === layer.textColor));
        document.querySelectorAll('[data-preset]').forEach(b => {
            const p = b.getAttribute('data-preset');
            b.classList.toggle('active', p === layer.inPreset && p === layer.outPreset);
        });
    }

    function loadSceneBgIntoUI(scene) {
        document.querySelectorAll('[data-bg]').forEach(b => b.classList.toggle('active', b.getAttribute('data-bg') === scene.background));
        if (scene.background === '#000000' || scene.background === 'sunset-radial') {
            canvasGridOverlay.classList.add('dark-mode');
        } else {
            canvasGridOverlay.classList.remove('dark-mode');
        }
    }

    btnAddLayer.addEventListener('click', () => {
        saveActiveLayerFromUI();
        const newLayer = createLayer({ text: 'New Text', startTime: 0 });
        getActiveLayers().push(newLayer);
        activeLayerIdx = getActiveLayers().length - 1;
        loadLayerIntoUI(getActiveLayer());
        renderLayerList();
        renderMiniTimeline(getActiveScene(), activeSceneIdx);
        syncTimeline(); draw(); refreshSceneThumbnails();
    });

    btnDeleteLayer.addEventListener('click', () => {
        const layers = getActiveLayers();
        if (layers.length <= 1) { showToast('Cannot delete the last layer.'); return; }
        layers.splice(activeLayerIdx, 1);
        activeLayerIdx = Math.min(activeLayerIdx, layers.length - 1);
        loadLayerIntoUI(getActiveLayer());
        renderLayerList();
        renderMiniTimeline(getActiveScene(), activeSceneIdx);
        syncTimeline(); draw(); refreshSceneThumbnails();
    });

    // ── SCENE UI ──────────────────────────────────────────────
    let dragSrcSceneIdx = null;

    function renderSceneList() {
        sceneListEl.innerHTML = '';
        scenes.forEach((scene, idx) => {
            // ── Scene card ──
            const card = document.createElement('div');
            card.className = 'scene-card' + (idx === activeSceneIdx ? ' active' : '');
            card.draggable = true;
            card.dataset.sceneIdx = idx;

            const handle = document.createElement('span');
            handle.className = 'scene-drag-handle';
            handle.textContent = '⠿';

            const thumbWrap = document.createElement('div');
            thumbWrap.className = 'scene-thumb-wrap';
            const arMap = { '16-9': '16/9', '9-16': '9/16', '1-1': '1/1' };
            thumbWrap.style.aspectRatio = arMap[currentRatio] || '16/9';
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width  = RESOLUTIONS[currentRatio].w;
            thumbCanvas.height = RESOLUTIONS[currentRatio].h;
            thumbCanvas.id = `thumb-${scene.id}`;
            thumbWrap.appendChild(thumbCanvas);

            const info = document.createElement('div');
            info.className = 'scene-card-info';
            const nameEl = document.createElement('span');
            nameEl.className = 'scene-card-name';
            nameEl.textContent = scene.name;
            const durEl = document.createElement('span');
            durEl.className = 'scene-card-duration';
            durEl.textContent = computeSceneDuration(scene).toFixed(1) + 's';
            info.appendChild(nameEl);
            info.appendChild(durEl);

            card.appendChild(handle);
            card.appendChild(thumbWrap);
            card.appendChild(info);

            // Prevent card drag when interacting with timeline or inputs
            card.addEventListener('mousedown', e => {
                const isControl = e.target.closest('.scene-mini-timeline') ||
                                  e.target.closest('select') ||
                                  e.target.closest('input') ||
                                  e.target.closest('button');
                if (isControl) {
                    card.draggable = false;
                }
            });

            // Mini-timeline (only for active scene)
            if (idx === activeSceneIdx) {
                const tlContainer = document.createElement('div');
                tlContainer.className = 'scene-mini-timeline';
                tlContainer.id = `mini-tl-${scene.id}`;
                card.appendChild(tlContainer);
            }

            // Click to switch scene
            card.addEventListener('click', () => {
                if (isPlayingAll) return;
                switchToScene(idx);
            });

            // Drag events
            card.addEventListener('dragstart', e => {
                dragSrcSceneIdx = idx;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', idx);
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                dragSrcSceneIdx = null;
                document.querySelectorAll('.scene-card').forEach(c => c.classList.remove('drag-over'));
            });
            card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag-over'); });
            card.addEventListener('dragleave', () => { card.classList.remove('drag-over'); });
            card.addEventListener('drop', e => {
                e.preventDefault();
                card.classList.remove('drag-over');
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                const toIdx = idx;
                if (fromIdx === toIdx) return;
                const [movedScene] = scenes.splice(fromIdx, 1);
                scenes.splice(toIdx, 0, movedScene);
                // Keep transitions in sync with the new order
                syncTransitionsArray();
                if (activeSceneIdx === fromIdx) activeSceneIdx = toIdx;
                else if (fromIdx < activeSceneIdx && toIdx >= activeSceneIdx) activeSceneIdx--;
                else if (fromIdx > activeSceneIdx && toIdx <= activeSceneIdx) activeSceneIdx++;
                renderSceneList();
                renderMiniTimeline(getActiveScene(), activeSceneIdx);
                renderSceneThumbnails();
            });

            sceneListEl.appendChild(card);

            // ── Transition strip (between scenes) ──
            if (idx < scenes.length - 1) {
                const tr = transitions[idx];
                const strip = document.createElement('div');
                strip.className = 'transition-strip';

                const sel = document.createElement('select');
                sel.className = 'transition-type-select';
                TRANSITION_TYPES.forEach(tt => {
                    const opt = document.createElement('option');
                    opt.value = tt.key;
                    opt.textContent = tt.label;
                    if (tt.key === tr.type) opt.selected = true;
                    sel.appendChild(opt);
                });
                sel.addEventListener('change', e => {
                    transitions[idx].type = e.target.value;
                });
                sel.addEventListener('click', e => e.stopPropagation());

                const durWrap = document.createElement('div');
                durWrap.className = 'transition-dur-wrap';

                const durSlider = document.createElement('input');
                durSlider.type  = 'range';
                durSlider.className = 'transition-dur-slider';
                durSlider.min   = '0';
                durSlider.max   = '15';
                durSlider.value = Math.round(tr.duration * 10);

                const durLabel = document.createElement('span');
                durLabel.className = 'transition-dur-label';
                durLabel.textContent = tr.duration.toFixed(1) + 's';

                durSlider.addEventListener('input', e => {
                    transitions[idx].duration = parseInt(e.target.value) / 10;
                    durLabel.textContent = transitions[idx].duration.toFixed(1) + 's';
                    syncTimeline();
                });
                durSlider.addEventListener('click', e => e.stopPropagation());

                durWrap.appendChild(durSlider);
                durWrap.appendChild(durLabel);
                strip.appendChild(sel);
                strip.appendChild(durWrap);
                sceneListEl.appendChild(strip);
            }
        });

        rebindCursorEvents();
    }

    // ── LAYER MINI-TIMELINE ───────────────────────────────────
    function renderMiniTimeline(scene, sceneIdx) {
        const container = document.getElementById(`mini-tl-${scene.id}`);
        if (!container) return;
        container.innerHTML = '';

        const sceneDur = computeSceneDuration(scene);
        const trackW   = container.clientWidth || 148; // fallback px

        // Ruler
        const ruler = document.createElement('div');
        ruler.className = 'mini-tl-ruler';
        const ticks = [0, 0.25, 0.5, 0.75, 1.0];
        ticks.forEach(f => {
            const t = document.createElement('div');
            t.className = 'mini-tl-ruler-tick';
            t.style.left = (f * 100) + '%';
            t.style.height = f === 0 || f === 1 ? '8px' : '5px';
            ruler.appendChild(t);
            if (f === 0 || f === 0.5 || f === 1) {
                const lbl = document.createElement('span');
                lbl.className = 'mini-tl-ruler-label';
                lbl.style.left = (f * 100) + '%';
                lbl.textContent = (f * sceneDur).toFixed(1) + 's';
                ruler.appendChild(lbl);
            }
        });
        container.appendChild(ruler);

        // Layer bars
        scene.layers.forEach((layer, lIdx) => {
            const totalLayerDur = layer.inDuration + layer.holdDuration + layer.outDuration;
            const leftPct   = (layer.startTime / sceneDur) * 100;
            const widthPct  = (totalLayerDur / sceneDur) * 100;
            const inPct     = (layer.inDuration / totalLayerDur) * 100;
            const holdPct   = (layer.holdDuration / totalLayerDur) * 100;
            const outPct    = (layer.outDuration / totalLayerDur) * 100;

            const track = document.createElement('div');
            track.className = 'mini-tl-track';

            const bar = document.createElement('div');
            bar.className = 'mini-tl-layer-bar' + (lIdx === activeLayerIdx ? ' active-bar' : '');
            bar.style.left  = Math.max(0, Math.min(100, leftPct)) + '%';
            bar.style.width = Math.max(1, Math.min(100 - leftPct, widthPct)) + '%';

            const zoneIn   = document.createElement('div');
            zoneIn.className = 'mini-tl-zone-in';
            zoneIn.style.width = inPct + '%';

            const zoneHold = document.createElement('div');
            zoneHold.className = 'mini-tl-zone-hold';
            zoneHold.style.width = holdPct + '%';
            const nameEl = document.createElement('span');
            nameEl.className = 'mini-tl-layer-name';
            nameEl.textContent = layer.name;
            zoneHold.appendChild(nameEl);

            const zoneOut  = document.createElement('div');
            zoneOut.className = 'mini-tl-zone-out';
            zoneOut.style.width = outPct + '%';

            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'mini-tl-resize-handle';

            bar.appendChild(zoneIn);
            bar.appendChild(zoneHold);
            bar.appendChild(zoneOut);
            bar.appendChild(resizeHandle);

            // Click bar → select layer
            bar.addEventListener('mousedown', e => {
                if (e.target === resizeHandle) return; // handled separately
                e.stopPropagation();

                // Select this layer
                saveActiveLayerFromUI();
                activeLayerIdx = lIdx;
                loadLayerIntoUI(scene.layers[lIdx]);
                renderLayerList();
                renderMiniTimeline(scene, sceneIdx);
                draw();

                // Drag bar to reposition (start time)
                const startX     = e.clientX;
                const origStart  = layer.startTime;
                const pxPerSec   = track.clientWidth / sceneDur;

                function onMove(ev) {
                    const dx = ev.clientX - startX;
                    const newStart = Math.max(0, origStart + dx / pxPerSec);
                    layer.startTime = Math.round(newStart * 10) / 10;
                    // update sliders if this is the active layer
                    if (activeLayerIdx === lIdx) {
                        sliderStart.value = Math.round(layer.startTime * 10);
                        valStart.textContent = layer.startTime.toFixed(1) + 's';
                    }
                    renderMiniTimeline(scene, sceneIdx);
                    syncTimeline();
                    draw();
                    refreshSceneThumbnails();
                }
                function onUp() {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                }
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });

            // Drag resize handle → change hold duration
            resizeHandle.addEventListener('mousedown', e => {
                e.stopPropagation();
                const startX    = e.clientX;
                const origHold  = layer.holdDuration;
                const pxPerSec  = track.clientWidth / sceneDur;

                function onMove(ev) {
                    const dx = ev.clientX - startX;
                    const newHold = Math.max(0, origHold + dx / pxPerSec);
                    layer.holdDuration = Math.round(newHold * 10) / 10;
                    if (activeLayerIdx === lIdx) {
                        sliderHold.value = Math.round(layer.holdDuration * 10);
                        valHold.textContent = layer.holdDuration.toFixed(1) + 's';
                    }
                    renderMiniTimeline(scene, sceneIdx);
                    syncTimeline();
                    draw();
                    refreshSceneThumbnails();
                }
                function onUp() {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                }
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });

            // Tooltip
            bar.title = `${layer.name} | Start: ${layer.startTime}s | In: ${layer.inDuration}s | Hold: ${layer.holdDuration}s | Out: ${layer.outDuration}s`;

            track.appendChild(bar);
            container.appendChild(track);
        });

        // Playhead
        if (!isPlayingAll || playAllSceneIdx === sceneIdx) {
            const ph = document.createElement('div');
            ph.className = 'mini-tl-playhead';
            ph.id = 'mini-tl-playhead';
            ph.style.left = ((currentTime / sceneDur) * 100) + '%';
            // Position it spanning all tracks — use absolute on container
            ph.style.position = 'absolute';
            ph.style.top      = '0';
            ph.style.height   = '100%';
            container.style.position = 'relative';
            container.appendChild(ph);
        }
    }

    function updateMiniTimelinePlayhead() {
        const ph = document.getElementById('mini-tl-playhead');
        if (!ph) return;
        const scene = getActiveScene();
        const dur   = computeSceneDuration(scene);
        ph.style.left = ((currentTime / dur) * 100) + '%';
    }

    // ── SCENE SWITCH ──────────────────────────────────────────
    function switchToScene(idx) {
        saveActiveLayerFromUI();
        activeSceneIdx = idx;
        activeLayerIdx = 0;
        const scene = getActiveScene();
        loadLayerIntoUI(scene.layers[0]);
        loadSceneBgIntoUI(scene);
        renderLayerList();
        renderSceneList();
        requestAnimationFrame(() => renderMiniTimeline(scene, idx));
        currentTime = 0;
        syncTimeline();
        draw();
    }

    btnAddScene.addEventListener('click', () => {
        saveActiveLayerFromUI();
        const newScene = createScene();
        scenes.push(newScene);
        syncTransitionsArray();
        switchToScene(scenes.length - 1);
        renderSceneThumbnails();
        showToast(`${newScene.name} added.`);
    });

    btnDeleteScene.addEventListener('click', () => {
        if (scenes.length <= 1) { showToast('Cannot delete the last scene.'); return; }
        const name = getActiveScene().name;
        scenes.splice(activeSceneIdx, 1);
        syncTransitionsArray();
        activeSceneIdx = Math.min(activeSceneIdx, scenes.length - 1);
        switchToScene(activeSceneIdx);
        renderSceneThumbnails();
        showToast(`${name} deleted.`);
    });

    // ── SCENE THUMBNAILS ──────────────────────────────────────
    function renderSceneThumbnail(scene) {
        const thumbCanvas = document.getElementById(`thumb-${scene.id}`);
        if (!thumbCanvas) return;
        const tCtx = thumbCanvas.getContext('2d');
        const w = thumbCanvas.width, h = thumbCanvas.height;

        if (scene.background === 'sunset') {
            const g = tCtx.createLinearGradient(0, 0, w, h);
            g.addColorStop(0, '#FFB59E'); g.addColorStop(0.5, '#FD8863'); g.addColorStop(1, '#9F4122');
            tCtx.fillStyle = g;
        } else if (scene.background === 'sunset-radial') {
            const g = tCtx.createRadialGradient(w/2, h/2, 50, w/2, h/2, Math.max(w, h)/1.2);
            g.addColorStop(0, '#FFB59E'); g.addColorStop(0.3, '#FD8863'); g.addColorStop(1, '#9F4122');
            tCtx.fillStyle = g;
        } else { tCtx.fillStyle = scene.background; }
        tCtx.fillRect(0, 0, w, h);

        scene.layers.forEach(layer => {
            if (!layer.visible) return;
            const tw = thumbCanvas.width;
            const layout = computeLayout(layer);
            const { lines, totalH, lineHeightPx, fontSize } = layout;
            const targetY = (1 - layer.posY / 100) * h;
            const startY  = targetY - totalH / 2 + fontSize * 0.8;
            tCtx.save();
            tCtx.font = `400 ${fontSize}px Syne`;
            tCtx.textBaseline = 'alphabetic';
            tCtx.fillStyle = layer.textColor === 'sunset' ? '#FD8863' : layer.textColor;
            lines.forEach((line, li) => {
                const lineY = startY + li * lineHeightPx;
                let x = layerLineXStart(layer, line.width, tw);
                line.chars.forEach(charObj => { tCtx.fillText(charObj.char, x, lineY); x += charObj.width + line.letterSpacingPx; });
            });
            tCtx.restore();
        });
    }

    function renderSceneThumbnails() { scenes.forEach(s => renderSceneThumbnail(s)); }
    function refreshSceneThumbnails() { requestAnimationFrame(() => renderSceneThumbnails()); }

    // ── LAYOUT ENGINE ─────────────────────────────────────────
    // Memoize layout computation — measureText is expensive, cache by content+style
    const layoutCache = new Map();

    function computeLayout(layer) {
        const key = `${layer.text}||${layer.fontSize}||${layer.letterSpacing}||${layer.lineHeight}`;
        if (layoutCache.has(key)) return layoutCache.get(key);

        const lines = layer.text.split('\n');
        const { fontSize, letterSpacing: lsVal, lineHeight: lhVal } = layer;
        ctx.save();
        ctx.font = `400 ${fontSize}px Syne`;
        const letterSpacingPx = (lsVal / 100) * fontSize;
        const lineHeightPx    = fontSize * (lhVal / 10);
        const layoutLines = lines.map((text) => {
            const chars = [];
            let totalW = 0;
            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                const cw = ctx.measureText(ch).width;
                chars.push({ char: ch, width: cw, xOff: totalW });
                totalW += cw + letterSpacingPx;
            }
            if (chars.length > 0) totalW -= letterSpacingPx;
            const words = [];
            let ci = 0;
            text.split(' ').forEach(wt => {
                if (!wt) { ci++; return; }
                let ww = 0;
                for (let k = 0; k < wt.length; k++) {
                    const co = chars[ci + k];
                    if (co) ww += co.width + (k < wt.length - 1 ? letterSpacingPx : 0);
                }
                words.push({ text: wt, width: ww, startIdx: ci, lineIdx: lines.indexOf(text) });
                ci += wt.length + 1;
            });
            return { text, width: Math.max(totalW, 0), chars, words, letterSpacingPx };
        });
        ctx.restore();
        const result = { lines: layoutLines, totalH: lines.length * lineHeightPx, lineHeightPx, fontSize, letterSpacingPx };
        // Cache with a max size to prevent unbounded growth
        if (layoutCache.size > 300) layoutCache.delete(layoutCache.keys().next().value);
        layoutCache.set(key, result);
        return result;
    }

    // ── BACKGROUND ────────────────────────────────────────────
    function drawBackground(bg) {
        const w = canvas.width, h = canvas.height;
        if (bg === 'sunset') {
            const g = ctx.createLinearGradient(0, 0, w, h);
            g.addColorStop(0, '#FFB59E'); g.addColorStop(0.5, '#FD8863'); g.addColorStop(1, '#9F4122');
            ctx.fillStyle = g;
        } else if (bg === 'sunset-radial') {
            const g = ctx.createRadialGradient(w/2, h/2, 50, w/2, h/2, Math.max(w, h)/1.2);
            g.addColorStop(0, '#FFB59E'); g.addColorStop(0.3, '#FD8863'); g.addColorStop(1, '#9F4122');
            ctx.fillStyle = g;
        } else { ctx.fillStyle = bg; }
        ctx.fillRect(0, 0, w, h);
    }

    function getTextFill(layer, x, y, w, h) {
        if (layer.textColor === 'sunset') {
            const g = ctx.createLinearGradient(x, y, x + w, y + h);
            g.addColorStop(0, '#FD8863'); g.addColorStop(1, '#9F4122');
            return g;
        }
        return layer.textColor;
    }

    function layerLineXStart(layer, lineWidth, canvasW) {
        const W = canvasW || canvas.width;
        const targetX = (layer.posX / 100) * W;
        if (layer.textAlign === 'left')  return targetX;
        if (layer.textAlign === 'right') return targetX - lineWidth;
        return targetX - lineWidth / 2;
    }

    // ── TRANSITION RENDERER ───────────────────────────────────
    // Renders a snapshot of a scene onto an offscreen canvas and returns it
    function captureSceneSnapshot(scene, time) {
        const off = document.createElement('canvas');
        off.width  = canvas.width;
        off.height = canvas.height;
        const oCtx = off.getContext('2d');

        // Swap variables temporarily to draw onto the offscreen canvas
        const originalCtx = ctx;
        const originalCanvas = canvas;
        ctx = oCtx;
        canvas = off;

        // Draw the scene at the target timestamp frame
        drawScene(scene, time);

        // Restore variables
        ctx = originalCtx;
        canvas = originalCanvas;

        return off;
    }

    function drawTransitionFrame(transition, p, scene1, scene2) {
        const W = canvas.width, H = canvas.height;
        const ep = ease.inOutCubic(p);

        switch (transition.type) {
            case 'cut': {
                drawScene(scene2, 0); break;
            }
            case 'crossfade': {
                drawScene(scene1, computeSceneDuration(scene1));
                ctx.save();
                ctx.globalAlpha = ep;
                const snap2 = captureSceneSnapshot(scene2, 0);
                ctx.drawImage(snap2, 0, 0);
                ctx.restore();
                break;
            }
            case 'flash': {
                if (p < 0.5) {
                    drawScene(scene1, computeSceneDuration(scene1));
                    ctx.save();
                    ctx.globalAlpha = p * 2;
                    ctx.fillStyle = '#FD8863';
                    ctx.fillRect(0, 0, W, H);
                    ctx.restore();
                } else {
                    drawScene(scene2, 0);
                    ctx.save();
                    ctx.globalAlpha = (1 - p) * 2;
                    ctx.fillStyle = '#FD8863';
                    ctx.fillRect(0, 0, W, H);
                    ctx.restore();
                }
                break;
            }
            case 'wipe-right': {
                drawScene(scene1, computeSceneDuration(scene1));
                const snap = captureSceneSnapshot(scene2, 0);
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, ep * W, H);
                ctx.clip();
                ctx.drawImage(snap, 0, 0);
                ctx.restore();
                break;
            }
            case 'wipe-up': {
                drawScene(scene1, computeSceneDuration(scene1));
                const snap3 = captureSceneSnapshot(scene2, 0);
                const revY = H - ep * H;
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, revY, W, H - revY);
                ctx.clip();
                ctx.drawImage(snap3, 0, 0);
                ctx.restore();
                break;
            }
            case 'zoom-through': {
                ctx.save();
                const scaleOut = 1 + ep * 0.4;
                ctx.globalAlpha = 1 - ep;
                ctx.filter = `blur(${ep * 20}px)`;
                ctx.translate(W/2, H/2);
                ctx.scale(scaleOut, scaleOut);
                ctx.translate(-W/2, -H/2);
                drawScene(scene1, computeSceneDuration(scene1));
                ctx.restore();
                ctx.filter = 'none';
                if (ep > 0.3) {
                    const scaleIn = 0.6 + ((ep - 0.3) / 0.7) * 0.4;
                    const inAlpha = Math.max(0, (ep - 0.3) / 0.7);
                    const inBlur  = Math.max(0, (1 - (ep - 0.3) / 0.7)) * 20;
                    ctx.save();
                    ctx.globalAlpha = inAlpha;
                    ctx.filter = `blur(${inBlur}px)`;
                    ctx.translate(W/2, H/2);
                    ctx.scale(scaleIn, scaleIn);
                    ctx.translate(-W/2, -H/2);
                    const sn = captureSceneSnapshot(scene2, 0);
                    ctx.drawImage(sn, 0, 0);
                    ctx.restore();
                    ctx.filter = 'none';
                }
                break;
            }
            case 'glitch': {
                const base = p < 0.5 ? scene1 : scene2;
                const baseTime = p < 0.5 ? computeSceneDuration(scene1) : 0;
                drawScene(base, baseTime);
                // RGB split slices
                const snap4 = captureSceneSnapshot(base, baseTime);
                const intensity = Math.sin(p * Math.PI) * 30;
                const slices = 8;
                for (let s = 0; s < slices; s++) {
                    const sy = Math.random() * H;
                    const sh = Math.random() * H / slices;
                    const offX = (Math.random() - 0.5) * intensity;
                    ctx.save();
                    ctx.globalAlpha = 0.7;
                    ctx.globalCompositeOperation = 'screen';
                    ctx.drawImage(snap4, 0, sy, W, sh, offX, sy, W, sh);
                    ctx.restore();
                }
                // Noise scanlines
                ctx.save();
                for (let row = 0; row < H; row += 4) {
                    if (Math.random() < 0.08 * Math.sin(p * Math.PI)) {
                        ctx.fillStyle = `rgba(${Math.random()*255|0},${Math.random()*255|0},${Math.random()*255|0},0.15)`;
                        ctx.fillRect(0, row, W, 2);
                    }
                }
                ctx.restore();
                break;
            }
            case 'scan-line': {
                drawScene(scene1, computeSceneDuration(scene1));
                const snap5 = captureSceneSnapshot(scene2, 0);
                const scanY = ep * H;
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, W, scanY);
                ctx.clip();
                ctx.drawImage(snap5, 0, 0);
                ctx.restore();
                // The glowing scan line
                const grad = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 20);
                grad.addColorStop(0, 'rgba(253,136,99,0)');
                grad.addColorStop(0.4, 'rgba(253,136,99,0.8)');
                grad.addColorStop(0.5, 'rgba(255,230,200,1)');
                grad.addColorStop(0.6, 'rgba(253,136,99,0.8)');
                grad.addColorStop(1, 'rgba(253,136,99,0)');
                ctx.save();
                ctx.fillStyle = grad;
                ctx.fillRect(0, scanY - 20, W, 40);
                ctx.restore();
                break;
            }
            case 'scatter': {
                const blockSize = 32;
                const cols = Math.ceil(W / blockSize);
                const rows = Math.ceil(H / blockSize);
                const fromSnap = p < 0.5 ? captureSceneSnapshot(scene1, computeSceneDuration(scene1)) : captureSceneSnapshot(scene2, 0);
                drawBackground(p < 0.5 ? scene1.background : scene2.background);
                const scatterP = p < 0.5 ? p * 2 : (1 - p) * 2;
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const seed   = (r * cols + c) * 7919;
                        const delay  = ((seed % 100) / 100) * 0.6;
                        const local  = Math.max(0, Math.min(1, (scatterP - delay) / 0.4));
                        const offX   = Math.cos(seed) * local * W * 0.15;
                        const offY   = Math.sin(seed) * local * H * 0.15;
                        const alpha  = 1 - local;
                        ctx.save();
                        ctx.globalAlpha = alpha;
                        ctx.drawImage(fromSnap, c * blockSize, r * blockSize, blockSize, blockSize,
                            c * blockSize + offX, r * blockSize + offY, blockSize, blockSize);
                        ctx.restore();
                    }
                }
                break;
            }
            default:
                drawScene(scene2, 0);
        }
    }

    // ── MAIN DRAW ─────────────────────────────────────────────
    function drawScene(scene, time) {
        drawBackground(scene.background);
        scene.layers.forEach(layer => {
            if (!layer.visible) return;
            const localTime     = time - layer.startTime;
            const layerDuration = layer.inDuration + layer.holdDuration + layer.outDuration;
            if (localTime < 0 || localTime > layerDuration) return;
            const layout = computeLayout(layer);
            const { lines, totalH, lineHeightPx, fontSize } = layout;
            const targetY = (1 - layer.posY / 100) * canvas.height;
            const startY  = targetY - totalH / 2 + fontSize * 0.8;
            let phase = 'in', p = 0;
            if (localTime <= layer.inDuration) {
                phase = 'in'; p = layer.inDuration > 0 ? localTime / layer.inDuration : 1;
            } else if (localTime <= layer.inDuration + layer.holdDuration) {
                phase = 'hold'; p = 1;
            } else {
                phase = 'out';
                const elapsed = localTime - layer.inDuration - layer.holdDuration;
                p = layer.outDuration > 0 ? elapsed / layer.outDuration : 1;
            }
            p = Math.max(0, Math.min(1, p));
            ctx.save();
            ctx.font = `400 ${fontSize}px Syne`;
            ctx.textBaseline = 'alphabetic';
            const activePreset = phase === 'out' ? layer.outPreset : layer.inPreset;
            const phaseSec     = phase === 'out' ? layer.outDuration : layer.inDuration;
            switch (activePreset) {
                case 'blueprint':   drawBlueprint(layer, lines, lineHeightPx, fontSize, startY, phase, p, phaseSec);  break;
                // Signal Scan (also accepts legacy key 'thermal')
                case 'signal':
                case 'thermal':     drawSignalScan(layer, lines, lineHeightPx, fontSize, startY, phase, p);           break;
                case 'typewriter':  drawTypewriter(layer, lines, lineHeightPx, fontSize, startY, phase, p, localTime); break;
                case 'slidein':     drawSlideIn(layer, lines, lineHeightPx, fontSize, startY, phase, p, phaseSec);    break;
                case 'slideup':     drawSlideUp(layer, lines, lineHeightPx, fontSize, startY, phase, p);              break;
                case 'focus':       drawFocus(layer, lines, lineHeightPx, fontSize, startY, layout, phase, p);        break;
                // Decode (also accepts legacy key 'blurzoom')
                case 'decode':
                case 'blurzoom':    drawDecode(layer, lines, lineHeightPx, fontSize, startY, phase, p);               break;
                case 'pop':         drawPop(layer, lines, lineHeightPx, fontSize, startY, phase, p, phaseSec);        break;
                case 'scatter':     drawScatter(layer, lines, lineHeightPx, fontSize, startY, phase, p, phaseSec);    break;
                case 'stamp':       drawStamp(layer, lines, lineHeightPx, fontSize, startY, phase, p);                break;
                case 'venetian':    drawVenetian(layer, lines, lineHeightPx, fontSize, startY, phase, p);             break;
                case 'curtain':     drawCurtain(layer, lines, lineHeightPx, fontSize, startY, phase, p);              break;
                case 'glitchshift': drawGlitchShift(layer, lines, lineHeightPx, fontSize, startY, phase, p);          break;
                case 'gemini':      drawGemini(layer, lines, lineHeightPx, fontSize, startY, phase, p);               break;
                case 'claude':      drawClaude(layer, lines, lineHeightPx, fontSize, startY, phase, p);               break;
                case 'grok':        drawGrok(layer, lines, lineHeightPx, fontSize, startY, phase, p);                 break;
                case 'sora':        drawSora(layer, lines, lineHeightPx, fontSize, startY, phase, p);                 break;
                case 'neural':      drawNeural(layer, lines, lineHeightPx, fontSize, startY, phase, p);               break;
            }
            ctx.restore();
        });
    }

    function draw() {
        if (isInTransition) {
            const tr = transitions[playAllSceneIdx];
            const p  = tr.duration > 0 ? transitionTime / tr.duration : 1;
            drawTransitionFrame(tr, Math.max(0, Math.min(1, p)), scenes[playAllSceneIdx], scenes[playAllSceneIdx + 1]);
        } else {
            const scene = isPlayingAll ? scenes[playAllSceneIdx] : getActiveScene();
            drawScene(scene, currentTime);
        }
    }

    // ── PRESET RENDERERS ──────────────────────────────────────

    function drawBlueprint(layer, lines, lineHeightPx, fontSize, startY, phase, p, phaseSec) {
        let totalChars = 0;
        lines.forEach(l => totalChars += l.chars.length);
        if (totalChars === 0) return;
        const staggerFrac       = (layer.staggerMs / 1000) / (phaseSec || layer.inDuration);
        const charAnimFrac      = 0.45;
        const normalizedStagger = Math.min(staggerFrac, (1 - charAnimFrac) / Math.max(totalChars - 1, 1));
        let gi = 0;
        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx;
            let x = layerLineXStart(layer, line.width);
            line.chars.forEach(charObj => {
                const delay = gi * normalizedStagger;
                gi++;
                let opacity = 1, scaleVal = 1, outlineOnly = false, dashPct = 1;
                if (phase === 'in') {
                    const tc = Math.max(0, Math.min(1, (p - delay) / charAnimFrac));
                    if (tc <= 0) { opacity = 0; }
                    else if (tc < 0.5) { opacity = 0.85; outlineOnly = true; dashPct = tc / 0.5; }
                    else { const fp = (tc - 0.5) / 0.5; opacity = 1; scaleVal = 0.95 + ease.outBack(fp) * 0.05; }
                } else if (phase === 'hold') { opacity = 1; }
                else {
                    const reverseDelay = (totalChars - 1 - (gi - 1)) * normalizedStagger;
                    const tc = Math.max(0, Math.min(1, (p - reverseDelay) / charAnimFrac));
                    opacity = 1 - ease.outCubic(tc); outlineOnly = tc > 0.4; dashPct = Math.max(0, 1 - tc * 2);
                }
                if (opacity > 0.01) {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    const cx = x + charObj.width / 2, cy = lineY - fontSize * 0.4;
                    ctx.translate(cx, cy); ctx.scale(scaleVal, scaleVal); ctx.translate(-cx, -cy);
                    if (outlineOnly) {
                        ctx.strokeStyle = '#FD8863'; ctx.lineWidth = Math.max(1, fontSize * 0.015);
                        ctx.setLineDash([charObj.width * 2 * dashPct, charObj.width * 2]);
                        ctx.strokeText(charObj.char, x, lineY); ctx.setLineDash([]);
                        ctx.strokeStyle = 'rgba(93,95,95,0.25)'; ctx.lineWidth = Math.max(0.5, fontSize * 0.008);
                        ctx.strokeText(charObj.char, x, lineY);
                    } else {
                        ctx.fillStyle = getTextFill(layer, x, lineY - fontSize, charObj.width, fontSize);
                        ctx.fillText(charObj.char, x, lineY);
                    }
                    ctx.restore();
                }
                x += charObj.width + line.letterSpacingPx;
            });
        });
    }

    // Signal Scan — a luminous beam sweeps left-to-right revealing each line via clipping.
    // Zero ctx.filter — all effects achieved with gradients, clipping and globalAlpha.
    function drawSignalScan(layer, lines, lineHeightPx, fontSize, startY, phase, p) {
        const W = canvas.width, H = canvas.height;
        let revealPct = 1, opacity = 1, exitPct = 0;

        if (phase === 'in') {
            const e = ease.outQuint(p);
            revealPct = e;
            opacity   = Math.min(1, p * 4); // quick fade-in of chars behind the beam
        } else if (phase === 'hold') {
            revealPct = 1; opacity = 1;
        } else {
            // Beam sweeps back right-to-left, erasing text
            const e = ease.inOutCubic(p);
            revealPct = 1 - e;
            opacity   = Math.max(0, 1 - p * 1.8);
        }

        if (opacity < 0.01) return;

        const beamX = revealPct * W;

        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx;
            const x = layerLineXStart(layer, line.width);

            // Draw revealed portion via clip
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, lineY - fontSize * 1.25, beamX, fontSize * 1.55);
            ctx.clip();
            ctx.globalAlpha = opacity;
            // Thermal gradient colour sweep across revealed text
            const g = ctx.createLinearGradient(0, 0, W, 0);
            const base = (layer.textColor === '#F9F9F9') ? '#F9F9F9' : '#000000';
            const safeStop = (pos, col) => g.addColorStop(Math.max(0, Math.min(1, pos)), col);
            const bw = 0.35;
            safeStop(Math.max(0, revealPct - bw), base);
            safeStop(Math.max(0, revealPct - bw * 0.5), '#FFB59E');
            safeStop(revealPct, '#FD8863');
            if (revealPct < 1) safeStop(Math.min(1, revealPct + 0.02), 'rgba(253,136,99,0.1)');
            ctx.fillStyle = (phase === 'hold') ? getTextFill(layer, x, lineY - fontSize, line.width, fontSize) : g;
            let cx = x;
            line.chars.forEach(c => { ctx.fillText(c.char, cx, lineY); cx += c.width + line.letterSpacingPx; });
            ctx.restore();
        });

        // Glowing scan-beam edge (only during in/out motion)
        if (phase !== 'hold' && revealPct > 0 && revealPct < 1) {
            const totalH = lines.length * lineHeightPx;
            const beamTop = startY - fontSize * 1.25;
            const beamH   = totalH + fontSize * 0.3;
            const glow = ctx.createLinearGradient(beamX - fontSize * 1.2, 0, beamX + 6, 0);
            glow.addColorStop(0,   'rgba(253,136,99,0)');
            glow.addColorStop(0.6, 'rgba(253,136,99,0.55)');
            glow.addColorStop(0.9, 'rgba(255,215,180,0.9)');
            glow.addColorStop(1,   'rgba(255,240,220,1)');
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.fillStyle = glow;
            ctx.fillRect(beamX - fontSize * 1.2, beamTop, fontSize * 1.2 + 6, beamH);
            ctx.restore();
        }
    }

    function drawTypewriter(layer, lines, lineHeightPx, fontSize, startY, phase, p, localTime) {
        let totalChars = 0;
        lines.forEach(l => totalChars += l.chars.length);
        if (totalChars === 0) return;
        let visible, opacity = 1;
        if (phase === 'in') { visible = Math.floor(p * totalChars); }
        else if (phase === 'hold') { visible = totalChars; }
        else { visible = Math.floor((1 - ease.outCubic(p)) * totalChars); opacity = 1 - p * 0.5; }
        const showCursor = Math.floor(localTime / 0.5) % 2 === 0 && phase !== 'out';
        let gi = 0, lastX = layerLineXStart(layer, lines[0]?.width || 0), lastLineY = startY;
        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx;
            let x = layerLineXStart(layer, line.width);
            line.chars.forEach(charObj => {
                if (gi < visible) {
                    ctx.save(); ctx.globalAlpha = opacity;
                    ctx.fillStyle = getTextFill(layer, x, lineY - fontSize, charObj.width, fontSize);
                    ctx.fillText(charObj.char, x, lineY); ctx.restore();
                    lastX = x + charObj.width + line.letterSpacingPx; lastLineY = lineY;
                } else if (gi === visible) { lastX = x; lastLineY = lineY; }
                gi++; x += charObj.width + line.letterSpacingPx;
            });
        });
        if (showCursor) {
            ctx.save(); ctx.fillStyle = '#FD8863'; ctx.globalAlpha = 0.9;
            const cw = Math.max(fontSize * 0.06, 4);
            ctx.fillRect(lastX + 2, lastLineY - fontSize * 0.85, cw, fontSize * 0.85);
            ctx.restore();
        }
    }

    function drawSlideIn(layer, lines, lineHeightPx, fontSize, startY, phase, p, phaseSec) {
        let totalChars = 0;
        lines.forEach(l => totalChars += l.chars.length);
        if (totalChars === 0) return;
        const staggerFrac       = (layer.staggerMs / 1000) / (phaseSec || layer.inDuration);
        const charAnimFrac      = 0.5;
        const normalizedStagger = Math.min(staggerFrac, (1 - charAnimFrac) / Math.max(totalChars - 1, 1));
        const slideDistance     = fontSize * 1.5;
        let gi = 0;
        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx;
            let x = layerLineXStart(layer, line.width);
            line.chars.forEach(charObj => {
                const delay = gi * normalizedStagger; gi++;
                let opacity = 1, xOffset = 0;
                if (phase === 'in') { const tc = Math.max(0, Math.min(1, (p - delay) / charAnimFrac)); opacity = ease.outCubic(tc); xOffset = (1 - ease.outQuint(tc)) * -slideDistance; }
                else if (phase === 'hold') { opacity = 1; xOffset = 0; }
                else { const reverseDelay = (totalChars - 1 - (gi - 1)) * normalizedStagger; const tc = Math.max(0, Math.min(1, (p - reverseDelay) / charAnimFrac)); opacity = 1 - ease.outCubic(tc); xOffset = ease.outQuint(tc) * slideDistance; }
                if (opacity > 0.01) {
                    ctx.save(); ctx.globalAlpha = opacity;
                    ctx.fillStyle = getTextFill(layer, x + xOffset, lineY - fontSize, charObj.width, fontSize);
                    ctx.fillText(charObj.char, x + xOffset, lineY); ctx.restore();
                }
                x += charObj.width + line.letterSpacingPx;
            });
        });
    }

    function drawSlideUp(layer, lines, lineHeightPx, fontSize, startY, phase, p) {
        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx;
            const x = layerLineXStart(layer, line.width);
            const lineStaggerFrac = 0.12 * li;
            let localP = phase === 'in' ? Math.max(0, Math.min(1, (p - lineStaggerFrac) / (1 - lineStaggerFrac + 0.001))) : p;
            let yOffset = 0, opacity = 1;
            if (phase === 'in') { const e = ease.outQuint(localP); yOffset = (1-e)*fontSize*1.1; opacity = localP; }
            else if (phase === 'hold') { yOffset = 0; opacity = 1; }
            else { const e = ease.outQuint(p); yOffset = -e*fontSize*1.1; opacity = 1-e; }
            ctx.save();
            ctx.beginPath(); ctx.rect(x - 20, lineY - fontSize * 1.2, line.width + 40, fontSize * 1.45); ctx.clip();
            ctx.globalAlpha = opacity;
            ctx.fillStyle = getTextFill(layer, x, lineY - fontSize + yOffset, line.width, fontSize);
            let cx = x;
            line.chars.forEach(charObj => { ctx.fillText(charObj.char, cx, lineY + yOffset); cx += charObj.width + line.letterSpacingPx; });
            ctx.restore();
        });
    }

    function drawFocus(layer, lines, lineHeightPx, fontSize, startY, layout, phase, p) {
        const allWords = [];
        lines.forEach(l => allWords.push(...l.words));
        if (allWords.length === 0) return;
        let activeIdx = allWords.length - 1, globalOpacity = 1;
        if (phase === 'in') activeIdx = Math.min(Math.floor(p * allWords.length), allWords.length - 1);
        else if (phase === 'out') globalOpacity = 1 - ease.outCubic(p);
        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx;
            let x = layerLineXStart(layer, line.width);
            line.chars.forEach((charObj, ci) => {
                const word = line.words.find(w => ci >= w.startIdx && ci < w.startIdx + w.text.length);
                let charOpacity = globalOpacity;
                if (word && phase === 'in') {
                    const wi = allWords.findIndex(w => w.lineIdx === word.lineIdx && w.startIdx === word.startIdx);
                    charOpacity = wi === activeIdx ? globalOpacity : globalOpacity * 0.25;
                }
                ctx.save(); ctx.globalAlpha = charOpacity;
                ctx.fillStyle = getTextFill(layer, x, lineY - fontSize, charObj.width, fontSize);
                ctx.fillText(charObj.char, x, lineY); ctx.restore();
                x += charObj.width + line.letterSpacingPx;
            });
        });
    }

    // Decode — characters scramble through block symbols then resolve to the real glyph.
    // The classic AI cipher/decryption effect. No ctx.filter, no blurs, pure fillText.
    const DECODE_SYMBOLS = '█▓▒░│┤╡╢╣║╗╝╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌';

    function drawDecode(layer, lines, lineHeightPx, fontSize, startY, phase, p) {
        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx;
            let x = layerLineXStart(layer, line.width);

            line.chars.forEach((charObj, ci) => {
                const totalChars = line.chars.length || 1;
                let opacity = 1;
                let displayChar = charObj.char;
                let isScrambling = false;

                if (phase === 'in') {
                    // Each char decodes left-to-right with a stagger
                    const stagger  = (ci / Math.max(totalChars - 1, 1)) * 0.55;
                    const charP    = Math.max(0, Math.min(1, (p - stagger) / 0.45));
                    if (charP <= 0) {
                        x += charObj.width + line.letterSpacingPx; return;
                    }
                    if (charP < 0.75) {
                        // Scramble window — show cycling symbol
                        const tick = Math.floor(Date.now() / 55 + ci * 11) % DECODE_SYMBOLS.length;
                        displayChar  = DECODE_SYMBOLS[tick];
                        opacity      = 0.75;
                        isScrambling = true;
                    } else {
                        // Resolved
                        displayChar = charObj.char;
                        opacity = ease.outCubic((charP - 0.75) / 0.25);
                    }
                } else if (phase === 'hold') {
                    displayChar = charObj.char; opacity = 1;
                } else {
                    // Out: chars un-resolve right-to-left
                    const stagger = (1 - ci / Math.max(totalChars - 1, 1)) * 0.45;
                    const charP   = Math.max(0, Math.min(1, (p - stagger) / 0.55));
                    if (charP < 0.35) {
                        displayChar = charObj.char; opacity = 1;
                    } else if (charP < 0.75) {
                        const tick = Math.floor(Date.now() / 55 + ci * 17) % DECODE_SYMBOLS.length;
                        displayChar  = DECODE_SYMBOLS[tick];
                        opacity      = 0.55;
                        isScrambling = true;
                    } else {
                        opacity = Math.max(0, 1 - (charP - 0.75) / 0.25);
                        x += charObj.width + line.letterSpacingPx; return;
                    }
                }

                if (opacity > 0.01) {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    if (isScrambling) {
                        // Scrambling chars render in sunset orange
                        ctx.fillStyle = '#FD8863';
                    } else {
                        ctx.fillStyle = getTextFill(layer, x, lineY - fontSize, charObj.width, fontSize);
                    }
                    ctx.fillText(displayChar, x, lineY);
                    ctx.restore();
                }
                x += charObj.width + line.letterSpacingPx;
            });
        });
    }

    // ── POP — chars scale from 0 with overshoot bounce, staggered (char-level) ──────────
    function drawPop(layer, lines, lineHeightPx, fontSize, startY, phase, p, phaseSec) {
        let totalChars = 0;
        lines.forEach(l => totalChars += l.chars.length);
        const staggerFrac       = (layer.staggerMs / 1000) / (phaseSec || layer.inDuration);
        const charAnimFrac      = 0.4;
        const normalizedStagger = Math.min(staggerFrac, (1 - charAnimFrac) / Math.max(totalChars - 1, 1));
        let gi = 0;
        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx;
            let x = layerLineXStart(layer, line.width);
            line.chars.forEach(charObj => {
                const delay = gi * normalizedStagger; gi++;
                let opacity = 1, scaleVal = 1;
                if (phase === 'in') {
                    const tc = Math.max(0, Math.min(1, (p - delay) / charAnimFrac));
                    if (tc <= 0) { opacity = 0; }
                    else { opacity = Math.min(1, tc * 4); scaleVal = ease.outBack(tc); }
                } else if (phase === 'hold') { opacity = 1; scaleVal = 1; }
                else {
                    const revDelay = (totalChars - 1 - (gi - 1)) * normalizedStagger;
                    const tc = Math.max(0, Math.min(1, (p - revDelay) / charAnimFrac));
                    opacity = 1 - ease.outCubic(tc); scaleVal = 1 - tc * 0.4;
                }
                if (opacity > 0.01) {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    const cx = x + charObj.width / 2, cy = lineY - fontSize * 0.4;
                    ctx.translate(cx, cy); ctx.scale(scaleVal, scaleVal); ctx.translate(-cx, -cy);
                    ctx.fillStyle = getTextFill(layer, x, lineY - fontSize, charObj.width, fontSize);
                    ctx.fillText(charObj.char, x, lineY);
                    ctx.restore();
                }
                x += charObj.width + line.letterSpacingPx;
            });
        });
    }

    // ── SCATTER — chars fly in from random positions and lock in place (char-level) ──────
    function drawScatter(layer, lines, lineHeightPx, fontSize, startY, phase, p, phaseSec) {
        let totalChars = 0;
        lines.forEach(l => totalChars += l.chars.length);
        const staggerFrac       = (layer.staggerMs / 1000) / (phaseSec || layer.inDuration);
        const charAnimFrac      = 0.5;
        const normalizedStagger = Math.min(staggerFrac, (1 - charAnimFrac) / Math.max(totalChars - 1, 1));
        const scatterDist = fontSize * 3.5;
        let gi = 0;
        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx;
            let x = layerLineXStart(layer, line.width);
            line.chars.forEach(charObj => {
                const delay = gi * normalizedStagger;
                const seed  = (gi * 7919 + li * 1337) % 1000;
                const angle = (seed / 1000) * Math.PI * 2;
                const scatterX = Math.cos(angle) * scatterDist;
                const scatterY = Math.sin(angle) * (scatterDist * 0.6);
                gi++;
                let opacity = 1, xOff = 0, yOff = 0;
                if (phase === 'in') {
                    const tc = Math.max(0, Math.min(1, (p - delay) / charAnimFrac));
                    if (tc <= 0) { x += charObj.width + line.letterSpacingPx; return; }
                    const e = ease.outQuint(tc);
                    opacity = ease.outCubic(tc);
                    xOff = scatterX * (1 - e); yOff = scatterY * (1 - e);
                } else if (phase === 'hold') { opacity = 1; }
                else {
                    const revDelay = (totalChars - 1 - (gi - 1)) * normalizedStagger;
                    const tc = Math.max(0, Math.min(1, (p - revDelay) / charAnimFrac));
                    const e = ease.outCubic(tc);
                    opacity = 1 - tc; xOff = scatterX * e; yOff = scatterY * e;
                }
                if (opacity > 0.01) {
                    ctx.save(); ctx.globalAlpha = opacity;
                    ctx.fillStyle = getTextFill(layer, x + xOff, lineY - fontSize + yOff, charObj.width, fontSize);
                    ctx.fillText(charObj.char, x + xOff, lineY + yOff);
                    ctx.restore();
                }
                x += charObj.width + line.letterSpacingPx;
            });
        });
    }

    // ── STAMP — words appear one at a time with a scale-down punch (word-level) ──────────
    function drawStamp(layer, lines, lineHeightPx, fontSize, startY, phase, p) {
        const allWords = [];
        lines.forEach(l => allWords.push(...l.words));
        if (allWords.length === 0) return;
        let globalOpacity = 1;
        if (phase === 'out') globalOpacity = Math.max(0, 1 - ease.outCubic(p) * 1.4);
        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx;
            let x = layerLineXStart(layer, line.width);
            line.chars.forEach((charObj, ci) => {
                const word = line.words.find(w => ci >= w.startIdx && ci < w.startIdx + w.text.length);
                let scaleVal = 1, opacity = globalOpacity;
                if (word && phase === 'in') {
                    const wi = allWords.findIndex(w => w.lineIdx === word.lineIdx && w.startIdx === word.startIdx);
                    const wordStart = wi / allWords.length;
                    const wordEnd   = (wi + 1) / allWords.length;
                    const wordP     = Math.max(0, Math.min(1, (p - wordStart) / Math.max(wordEnd - wordStart, 0.01)));
                    opacity  = Math.min(1, wordP * 5);
                    scaleVal = 1.3 - 0.3 * ease.outBack(wordP);
                }
                if (opacity > 0.01) {
                    ctx.save(); ctx.globalAlpha = opacity;
                    if (scaleVal !== 1) {
                        const cx = x + charObj.width / 2, cy = lineY - fontSize * 0.4;
                        ctx.translate(cx, cy); ctx.scale(scaleVal, scaleVal); ctx.translate(-cx, -cy);
                    }
                    ctx.fillStyle = getTextFill(layer, x, lineY - fontSize, charObj.width, fontSize);
                    ctx.fillText(charObj.char, x, lineY);
                    ctx.restore();
                }
                x += charObj.width + line.letterSpacingPx;
            });
        });
    }

    // ── VENETIAN — lines expand vertically from center, like venetian blinds (line-level) ─
    function drawVenetian(layer, lines, lineHeightPx, fontSize, startY, phase, p) {
        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx;
            const x = layerLineXStart(layer, line.width);
            const stagger = 0.1 * li;
            let localP = Math.max(0, Math.min(1, (p - stagger) / Math.max(1 - stagger, 0.01)));
            let revealH = 0, opacity = 1;
            if (phase === 'in')        { revealH = ease.outQuint(localP) * fontSize * 1.45; opacity = localP > 0 ? 1 : 0; }
            else if (phase === 'hold') { revealH = fontSize * 1.45; opacity = 1; }
            else                       { revealH = (1 - ease.outQuint(p)) * fontSize * 1.45; opacity = Math.max(0, 1 - p * 1.5); }
            if (revealH < 1 || opacity < 0.01) return;
            const centerY = lineY - fontSize * 0.28;
            ctx.save();
            ctx.beginPath();
            ctx.rect(x - 20, centerY - revealH / 2, line.width + 40, revealH);
            ctx.clip();
            ctx.globalAlpha = opacity;
            ctx.fillStyle = getTextFill(layer, x, lineY - fontSize, line.width, fontSize);
            let cx = x;
            line.chars.forEach(c => { ctx.fillText(c.char, cx, lineY); cx += c.width + line.letterSpacingPx; });
            ctx.restore();
        });
    }

    // ── CURTAIN — each line clips horizontally from center outward (line-level) ──────────
    function drawCurtain(layer, lines, lineHeightPx, fontSize, startY, phase, p) {
        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx;
            const lineX = layerLineXStart(layer, line.width);
            const stagger = 0.12 * li;
            let localP = Math.max(0, Math.min(1, (p - stagger) / Math.max(1 - stagger, 0.01)));
            let revealW = 0, opacity = 1;
            if (phase === 'in')        { revealW = ease.outQuint(localP) * (line.width + 40); opacity = localP; }
            else if (phase === 'hold') { revealW = line.width + 40; opacity = 1; }
            else                       { revealW = (1 - ease.outCubic(p)) * (line.width + 40); opacity = Math.max(0, 1 - p * 1.5); }
            if (revealW < 1 || opacity < 0.01) return;
            const centerX = lineX + line.width / 2;
            ctx.save();
            ctx.beginPath();
            ctx.rect(centerX - revealW / 2, lineY - fontSize * 1.2, revealW, fontSize * 1.5);
            ctx.clip();
            ctx.globalAlpha = opacity;
            ctx.fillStyle = getTextFill(layer, lineX, lineY - fontSize, line.width, fontSize);
            let cx = lineX;
            line.chars.forEach(c => { ctx.fillText(c.char, cx, lineY); cx += c.width + line.letterSpacingPx; });
            ctx.restore();
        });
    }

    // ── GLITCH SHIFT — lines slide in with jitter + chromatic aberration (line-level) ─────
    function drawGlitchShift(layer, lines, lineHeightPx, fontSize, startY, phase, p) {
        const maxShift = fontSize * 2.2;
        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx;
            const x = layerLineXStart(layer, line.width);
            const stagger = 0.14 * li;
            let localP = Math.max(0, Math.min(1, (p - stagger) / Math.max(1 - stagger, 0.01)));
            const shiftDir = li % 2 === 0 ? 1 : -1;
            let xOff = 0, opacity = 1;
            if (phase === 'in') {
                const e = ease.outQuint(localP);
                xOff = shiftDir * maxShift * (1 - e);
                if (localP > 0.05 && localP < 0.65) {
                    const jSeed = Math.floor(localP * 18 + li);
                    xOff += ((jSeed * 73) % 22 - 11) * (1 - localP);
                }
                opacity = Math.min(1, localP * 3);
            } else if (phase === 'hold') { xOff = 0; opacity = 1; }
            else {
                const e = ease.outCubic(p);
                xOff = -shiftDir * maxShift * e;
                opacity = Math.max(0, 1 - p * 1.8);
            }
            if (opacity < 0.01) return;
            ctx.save();
            ctx.globalAlpha = Math.min(1, opacity);
            ctx.fillStyle = getTextFill(layer, x + xOff, lineY - fontSize, line.width, fontSize);
            let cx = x + xOff;
            line.chars.forEach(c => { ctx.fillText(c.char, cx, lineY); cx += c.width + line.letterSpacingPx; });
            // Chromatic aberration ghost during entry
            if (phase === 'in' && localP > 0.05 && localP < 0.55) {
                ctx.globalAlpha = Math.min(0.35, opacity * 0.4);
                ctx.fillStyle = '#FD8863';
                let gcx = x + xOff + 4;
                line.chars.forEach(c => { ctx.fillText(c.char, gcx, lineY); gcx += c.width + line.letterSpacingPx; });
            }
            ctx.restore();
        });
    }

    // ── GEMINI AURA (Google) — glowing multi-color gradient sweep revealing text ──────────
    function drawGemini(layer, lines, lineHeightPx, fontSize, startY, phase, p) {
        const W = canvas.width;
        let opacity = 1;
        let sweepPct = p;

        if (phase === 'in') {
            opacity = Math.min(1, p * 3);
        } else if (phase === 'hold') {
            sweepPct = 0.5; // settle in the middle
            opacity = 1;
        } else {
            opacity = Math.max(0, 1 - p * 1.5);
            sweepPct = 1 - p;
        }

        if (opacity < 0.01) return;

        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx;
            const x = layerLineXStart(layer, line.width);
            let cx = x;

            // Define the Gemini color aura coordinates
            const sweepX = sweepPct * (line.width + 200) - 100 + x;

            line.chars.forEach((charObj, ci) => {
                const charCenterX = cx + charObj.width / 2;
                const distToSweep = Math.abs(charCenterX - sweepX);
                const maxDist = fontSize * 3.5;

                ctx.save();
                ctx.globalAlpha = opacity;

                if (distToSweep < maxDist && phase !== 'hold') {
                    // Character is touched by the sweep aura — blend towards a glowing gradient
                    const factor = 1 - (distToSweep / maxDist);
                    const scaleVal = 1 + factor * 0.12;

                    ctx.translate(charCenterX, lineY - fontSize * 0.4);
                    ctx.scale(scaleVal, scaleVal);
                    ctx.translate(-charCenterX, -(lineY - fontSize * 0.4));

                    // Gemini blue-indigo-pink gradient
                    const g = ctx.createLinearGradient(cx, lineY - fontSize, cx + charObj.width, lineY);
                    g.addColorStop(0, '#3b82f6');
                    g.addColorStop(0.5, '#8b5cf6');
                    g.addColorStop(1, '#ec4899');
                    ctx.fillStyle = g;
                } else {
                    ctx.fillStyle = getTextFill(layer, cx, lineY - fontSize, charObj.width, fontSize);
                }

                ctx.fillText(charObj.char, cx, lineY);
                ctx.restore();

                cx += charObj.width + line.letterSpacingPx;
            });
        });
    }

    // ── CLAUDE RISE (Anthropic) — elegant typographic rise with soft tracking drift ──────
    function drawClaude(layer, lines, lineHeightPx, fontSize, startY, phase, p) {
        let opacity = 1;
        let yOffset = 0;
        let extraTracking = 0;

        if (phase === 'in') {
            const e = ease.outQuint(p);
            opacity = ease.outCubic(p);
            yOffset = (1 - e) * (fontSize * 0.3);
            extraTracking = (1 - e) * (fontSize * 0.08);
        } else if (phase === 'hold') {
            opacity = 1;
            yOffset = 0;
            extraTracking = 0;
        } else {
            const e = ease.inQuint(p);
            opacity = Math.max(0, 1 - p * 1.5);
            yOffset = -e * (fontSize * 0.25);
            extraTracking = e * (fontSize * 0.06);
        }

        if (opacity < 0.01) return;

        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx + yOffset;
            const stepW = extraTracking;
            const totalW = line.width + stepW * Math.max(line.chars.length - 1, 0);
            let cx = layerLineXStart(layer, totalW);

            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.fillStyle = getTextFill(layer, cx, lineY - fontSize, totalW, fontSize);

            line.chars.forEach(charObj => {
                ctx.fillText(charObj.char, cx, lineY);
                cx += charObj.width + line.letterSpacingPx + stepW;
            });
            ctx.restore();
        });
    }

    // ── GROK BINARY (xAI) — letters flicker and resolve out of binary 0/1 code ──────────
    function drawGrok(layer, lines, lineHeightPx, fontSize, startY, phase, p) {
        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx;
            let cx = layerLineXStart(layer, line.width);
            const totalChars = line.chars.length || 1;

            line.chars.forEach((charObj, ci) => {
                let opacity = 1;
                let displayChar = charObj.char;
                let isBinary = false;

                if (phase === 'in') {
                    const stagger = (ci / totalChars) * 0.45;
                    const charP = Math.max(0, Math.min(1, (p - stagger) / 0.55));
                    if (charP <= 0) {
                        cx += charObj.width + line.letterSpacingPx; return;
                    }
                    if (charP < 0.75) {
                        // Display binary digit (0 or 1)
                        const randomTick = Math.floor(Date.now() / 60 + ci) % 2;
                        displayChar = randomTick.toString();
                        isBinary = true;
                        opacity = 0.8;
                    } else {
                        displayChar = charObj.char;
                        opacity = ease.outCubic((charP - 0.75) / 0.25);
                    }
                } else if (phase === 'hold') {
                    displayChar = charObj.char;
                    opacity = 1;
                } else {
                    const stagger = ((totalChars - 1 - ci) / totalChars) * 0.45;
                    const charP = Math.max(0, Math.min(1, (p - stagger) / 0.55));
                    if (charP < 0.4) {
                        displayChar = charObj.char; opacity = 1;
                    } else if (charP < 0.8) {
                        const randomTick = Math.floor(Date.now() / 60 + ci) % 2;
                        displayChar = randomTick.toString();
                        isBinary = true;
                        opacity = 0.7;
                    } else {
                        opacity = Math.max(0, 1 - (charP - 0.8) / 0.2);
                        cx += charObj.width + line.letterSpacingPx; return;
                    }
                }

                if (opacity > 0.01) {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    if (isBinary) {
                        ctx.fillStyle = '#00ff66'; // grok signature binary green
                        ctx.font = `600 ${fontSize}px monospace`;
                    } else {
                        ctx.fillStyle = getTextFill(layer, cx, lineY - fontSize, charObj.width, fontSize);
                    }
                    ctx.fillText(displayChar, cx, lineY);
                    ctx.restore();
                }
                cx += charObj.width + line.letterSpacingPx;
            });
        });
    }

    // ── SORA WAVE (OpenAI) — liquid vertical sine wave ripple as characters enter ───────
    function drawSora(layer, lines, lineHeightPx, fontSize, startY, phase, p) {
        lines.forEach((line, li) => {
            const lineY = startY + li * lineHeightPx;
            let cx = layerLineXStart(layer, line.width);
            const totalChars = line.chars.length || 1;

            line.chars.forEach((charObj, ci) => {
                let opacity = 1;
                let yOffset = 0;
                let scaleVal = 1;

                if (phase === 'in') {
                    const stagger = (ci / totalChars) * 0.5;
                    const charP = Math.max(0, Math.min(1, (p - stagger) / 0.5));
                    if (charP <= 0) {
                        cx += charObj.width + line.letterSpacingPx; return;
                    }
                    opacity = ease.outCubic(charP);
                    scaleVal = 0.5 + 0.5 * ease.outBack(charP);
                    // Sine wave ripple offset
                    yOffset = Math.sin(p * Math.PI * 2.5 - ci * 0.5) * (fontSize * 0.35) * (1 - charP);
                } else if (phase === 'hold') {
                    opacity = 1;
                    yOffset = 0;
                    scaleVal = 1;
                } else {
                    const stagger = ((totalChars - 1 - ci) / totalChars) * 0.5;
                    const charP = Math.max(0, Math.min(1, (p - stagger) / 0.5));
                    opacity = Math.max(0, 1 - charP);
                    scaleVal = 1 - charP * 0.3;
                    yOffset = Math.sin(p * Math.PI * 2.5 + ci * 0.5) * (fontSize * 0.25) * charP;
                }

                if (opacity > 0.01) {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    const charCenterX = cx + charObj.width / 2;
                    const charCenterY = lineY - fontSize * 0.4 + yOffset;
                    ctx.translate(charCenterX, charCenterY);
                    ctx.scale(scaleVal, scaleVal);
                    ctx.translate(-charCenterX, -charCenterY);

                    ctx.fillStyle = getTextFill(layer, cx, lineY - fontSize + yOffset, charObj.width, fontSize);
                    ctx.fillText(charObj.char, cx, lineY + yOffset);
                    ctx.restore();
                }
                cx += charObj.width + line.letterSpacingPx;
            });
        });
    }

    // ── NEURAL GRID — word wireframes draw in first, then text resolves inside ───────────
    function drawNeural(layer, lines, lineHeightPx, fontSize, startY, phase, p) {
        let opacity = 1;
        let wireframeAlpha = 0;

        if (phase === 'in') {
            opacity = Math.max(0, (p - 0.3) / 0.7);
            wireframeAlpha = p < 0.6 ? Math.min(1, p * 2.5) : Math.max(0, 1 - (p - 0.6) / 0.4);
        } else if (phase === 'hold') {
            opacity = 1;
            wireframeAlpha = 0;
        } else {
            opacity = Math.max(0, 1 - p * 1.5);
            wireframeAlpha = p < 0.5 ? p * 0.6 : Math.max(0, 0.3 - (p - 0.5) * 0.6);
        }

        // Draw bounding boxes around words if wireframeAlpha > 0.01
        if (wireframeAlpha > 0.01) {
            lines.forEach((line, li) => {
                const lineY = startY + li * lineHeightPx;
                const startX = layerLineXStart(layer, line.width);

                line.words.forEach(word => {
                    // Measure word coordinates
                    let wordW = word.width;
                    let wordX = startX + line.chars[word.startIdx].xOff;
                    let wordY = lineY - fontSize * 0.85;
                    let wordH = fontSize * 1.05;

                    ctx.save();
                    ctx.globalAlpha = wireframeAlpha;
                    ctx.strokeStyle = '#00f0ff'; // Neon tech cyan
                    ctx.lineWidth = 1.5;
                    
                    // Draw a stylized cyber box with corner indicators
                    ctx.strokeRect(wordX - 4, wordY - 2, wordW + 8, wordH + 4);
                    
                    // Small crosshair ticks
                    ctx.fillStyle = '#00f0ff';
                    ctx.fillRect(wordX - 6, wordY - 4, 4, 2);
                    ctx.fillRect(wordX - 6, wordY - 4, 2, 4);
                    ctx.fillRect(wordX + wordW + 4, wordY - 4, 4, 2);
                    ctx.fillRect(wordX + wordW + 6, wordY - 4, 2, 4);
                    
                    ctx.restore();
                });
            });
        }

        // Draw actual text
        if (opacity > 0.01) {
            lines.forEach((line, li) => {
                const lineY = startY + li * lineHeightPx;
                let cx = layerLineXStart(layer, line.width);

                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.fillStyle = getTextFill(layer, cx, lineY - fontSize, line.width, fontSize);

                line.chars.forEach(charObj => {
                    ctx.fillText(charObj.char, cx, lineY);
                    cx += charObj.width + line.letterSpacingPx;
                });
                ctx.restore();
            });
        }
    }

    // ── PLAYBACK ENGINE ───────────────────────────────────────
    function tick(ts) {
        if (!lastTimestamp) lastTimestamp = ts;
        const delta = (ts - lastTimestamp) / 1000;
        lastTimestamp = ts;

        if (isPlaying) {
            if (isPlayingAll) {
                if (isInTransition) {
                    transitionTime += delta;
                    const tr = transitions[playAllSceneIdx];
                    if (transitionTime >= tr.duration) {
                        // Transition done → advance to next scene
                        isInTransition = false;
                        transitionTime = 0;
                        playAllSceneIdx++;
                        currentTime = 0;
                        if (playAllSceneIdx >= scenes.length) {
                            playAllSceneIdx = scenes.length - 1;
                            stopPlayAll(); return;
                        }
                        activeSceneIdx = playAllSceneIdx;
                        activeLayerIdx = 0;
                        loadLayerIntoUI(scenes[activeSceneIdx].layers[0]);
                        loadSceneBgIntoUI(scenes[activeSceneIdx]);
                        renderLayerList(); renderSceneList();
                        requestAnimationFrame(() => renderMiniTimeline(scenes[activeSceneIdx], activeSceneIdx));
                    }
                } else {
                    currentTime += delta;
                    const sceneDur = computeSceneDuration(scenes[playAllSceneIdx]);
                    if (currentTime >= sceneDur) {
                        currentTime = sceneDur;
                        // Check if there's a transition after this scene
                        const tr = transitions[playAllSceneIdx];
                        if (tr && tr.type !== 'cut' && tr.duration > 0 && playAllSceneIdx < scenes.length - 1) {
                            isInTransition = true;
                            transitionTime = 0;
                        } else {
                            // No transition, advance directly
                            playAllSceneIdx++;
                            currentTime = 0;
                            if (playAllSceneIdx >= scenes.length) {
                                playAllSceneIdx = scenes.length - 1;
                                stopPlayAll(); return;
                            }
                            activeSceneIdx = playAllSceneIdx;
                            activeLayerIdx = 0;
                            loadLayerIntoUI(scenes[activeSceneIdx].layers[0]);
                            loadSceneBgIntoUI(scenes[activeSceneIdx]);
                            renderLayerList(); renderSceneList();
                            requestAnimationFrame(() => renderMiniTimeline(scenes[activeSceneIdx], activeSceneIdx));
                        }
                    }
                }
            } else {
                currentTime += delta;
                const total = computeSceneDuration(getActiveScene());
                if (currentTime >= total) { currentTime = total; pause(); }
            }
            syncTimeline();
            updateMiniTimelinePlayhead();
        }

        draw();
        if (isPlaying) rafId = requestAnimationFrame(tick);
        else rafId = null;
    }

    function play() {
        if (isPlaying) return;
        const total = isPlayingAll ? computeSceneDuration(scenes[playAllSceneIdx]) : computeSceneDuration(getActiveScene());
        if (!isInTransition && currentTime >= total) currentTime = 0;
        isPlaying = true; lastTimestamp = 0;
        playIcon.textContent = 'pause';
        btnPlayPause.classList.add('active');
        rafId = requestAnimationFrame(tick);
    }

    function pause() {
        isPlaying = false;
        playIcon.textContent = 'play_arrow';
        btnPlayPause.classList.remove('active');
    }

    function stop() {
        if (isPlayingAll) stopPlayAll();
        isInTransition = false; transitionTime = 0;
        pause(); currentTime = 0;
        syncTimeline(); draw();
    }

    function startPlayAll() {
        saveActiveLayerFromUI();
        isPlayingAll = true; playAllSceneIdx = 0;
        isInTransition = false; transitionTime = 0;
        currentTime = 0;
        activeSceneIdx = 0; activeLayerIdx = 0;
        loadLayerIntoUI(scenes[0].layers[0]);
        loadSceneBgIntoUI(scenes[0]);
        renderLayerList(); renderSceneList();
        requestAnimationFrame(() => renderMiniTimeline(scenes[0], 0));
        btnPlayAll.classList.add('active');
        play();
    }

    function stopPlayAll() {
        isPlayingAll = false; isInTransition = false; transitionTime = 0;
        btnPlayAll.classList.remove('active');
        pause(); renderSceneList();
        requestAnimationFrame(() => renderMiniTimeline(getActiveScene(), activeSceneIdx));
    }

    btnPlayPause.addEventListener('click', () => { isPlaying ? pause() : play(); });
    btnStop.addEventListener('click', stop);
    btnPlayAll.addEventListener('click', () => { isPlayingAll ? stopPlayAll() : startPlayAll(); });

    timelineScrubber.addEventListener('input', e => {
        if (isPlayingAll) return;
        pause();
        currentTime = (parseInt(e.target.value) / 100) * computeSceneDuration(getActiveScene());
        syncTimeline(); updateMiniTimelinePlayhead(); draw();
    });

    // ── TIMING CONTROLS ───────────────────────────────────────
    function readTimingsFromUI() {
        const layer = getActiveLayer();
        if (!layer) return;
        layer.startTime    = parseInt(sliderStart.value) / 10;
        layer.inDuration   = parseInt(sliderIn.value) / 10;
        layer.holdDuration = parseInt(sliderHold.value) / 10;
        layer.outDuration  = parseInt(sliderOut.value) / 10;
        layer.staggerMs    = parseInt(sliderStagger.value);
        valStart.textContent   = layer.startTime.toFixed(1) + 's';
        valIn.textContent      = layer.inDuration.toFixed(1) + 's';
        valHold.textContent    = layer.holdDuration.toFixed(1) + 's';
        valOut.textContent     = layer.outDuration.toFixed(1) + 's';
        valStagger.textContent = layer.staggerMs + 'ms';
        syncTimeline(); draw(); refreshSceneThumbnails();
        renderMiniTimeline(getActiveScene(), activeSceneIdx);
    }
    sliderStart.addEventListener('input', readTimingsFromUI);
    sliderIn.addEventListener('input', readTimingsFromUI);
    sliderHold.addEventListener('input', readTimingsFromUI);
    sliderOut.addEventListener('input', readTimingsFromUI);
    sliderStagger.addEventListener('input', readTimingsFromUI);

    // ── PRESET BUTTONS ────────────────────────────────────────
    const DEFAULT_TIMINGS = {
        blueprint:  { in: 15, hold: 10, out: 8,  stagger: 100 },
        thermal:    { in: 12, hold: 12, out: 8,  stagger: 0   },
        typewriter: { in: 18, hold: 10, out: 10, stagger: 0   },
        slidein:    { in: 12, hold: 10, out: 8,  stagger: 80  },
        slideup:    { in: 10, hold: 10, out: 8,  stagger: 0   },
        focus:      { in: 25, hold: 10, out: 8,  stagger: 150 },
        blurzoom:   { in: 10, hold: 12, out: 8,  stagger: 0   },
    };
    document.querySelectorAll('[data-preset]').forEach(btn => {
        btn.addEventListener('click', e => {
            const targetBtn = e.target.closest('[data-preset]');
            document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
            targetBtn.classList.add('active');
            const pName = targetBtn.getAttribute('data-preset');
            const layer = getActiveLayer();
            layer.inPreset = pName; layer.outPreset = pName;
            selectIn.value = pName; selectOut.value = pName;
            const d = DEFAULT_TIMINGS[pName] || { in: 10, hold: 10, out: 8, stagger: 80 };
            sliderIn.value = d.in; sliderHold.value = d.hold; sliderOut.value = d.out; sliderStagger.value = d.stagger;
            readTimingsFromUI(); stop();
        });
    });
    selectIn.addEventListener('change', e => { getActiveLayer().inPreset = e.target.value; draw(); refreshSceneThumbnails(); });
    selectOut.addEventListener('change', e => { getActiveLayer().outPreset = e.target.value; draw(); refreshSceneThumbnails(); });

    // ── TYPOGRAPHY CONTROLS ───────────────────────────────────
    textInput.addEventListener('input', () => { getActiveLayer().text = textInput.value; draw(); refreshSceneThumbnails(); });
    sliderFontSize.addEventListener('input', e => { getActiveLayer().fontSize = parseInt(e.target.value); valFontSize.textContent = e.target.value + 'px'; draw(); refreshSceneThumbnails(); });
    sliderLetterSpacing.addEventListener('input', e => { getActiveLayer().letterSpacing = parseInt(e.target.value); valLetterSpacing.textContent = (parseInt(e.target.value) / 100).toFixed(2) + 'em'; draw(); refreshSceneThumbnails(); });
    sliderLineHeight.addEventListener('input', e => { getActiveLayer().lineHeight = parseInt(e.target.value); valLineHeight.textContent = (parseInt(e.target.value) / 10).toFixed(1) + 'x'; draw(); refreshSceneThumbnails(); });

    // ── COORDINATE CONTROLS ───────────────────────────────────
    function updateCoordinateUI(x, y) {
        getActiveLayer().posX = x; getActiveLayer().posY = y;
        sliderPosX.value = x; sliderPosY.value = y;
        valPosX.textContent = x + '%'; valPosY.textContent = y + '%';
    }
    sliderPosX.addEventListener('input', e => { getActiveLayer().posX = parseInt(e.target.value); valPosX.textContent = e.target.value + '%'; document.querySelectorAll('[data-align]').forEach(b => b.classList.remove('active')); draw(); refreshSceneThumbnails(); });
    sliderPosY.addEventListener('input', e => { getActiveLayer().posY = parseInt(e.target.value); valPosY.textContent = e.target.value + '%'; document.querySelectorAll('[data-align]').forEach(b => b.classList.remove('active')); draw(); refreshSceneThumbnails(); });

    document.querySelectorAll('[data-align]').forEach(btn => {
        btn.addEventListener('click', e => {
            document.querySelectorAll('[data-align]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const align = e.target.getAttribute('data-align');
            getActiveLayer().textAlign = align;
            if (align === 'left') updateCoordinateUI(6, 50);
            else if (align === 'right') updateCoordinateUI(94, 50);
            else updateCoordinateUI(50, 50);
            draw(); refreshSceneThumbnails();
        });
    });

    document.querySelectorAll('.swatch-row [data-color]').forEach(btn => {
        btn.addEventListener('click', e => {
            document.querySelectorAll('.swatch-row [data-color]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            getActiveLayer().textColor = e.target.getAttribute('data-color');
            draw(); refreshSceneThumbnails();
        });
    });

    // ── CANVAS DRAG POSITIONING ───────────────────────────────
    let isDragging = false;
    function handleDrag(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const pctX = Math.round(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
        const pctY = Math.round(Math.max(0, Math.min(100, (1 - (clientY - rect.top) / rect.height) * 100)));
        updateCoordinateUI(pctX, pctY);
        document.querySelectorAll('[data-align]').forEach(b => b.classList.remove('active'));
        draw();
    }
    canvas.addEventListener('mousedown', e => { isDragging = true; handleDrag(e.clientX, e.clientY); customCursor.className = 'hover-canvas'; });
    window.addEventListener('mousemove', e => { if (isDragging) handleDrag(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { if (isDragging) { isDragging = false; customCursor.className = ''; refreshSceneThumbnails(); } });

    // ── VIEWPORT / BACKGROUND CONTROLS ───────────────────────
    document.querySelectorAll('[data-ratio]').forEach(btn => {
        btn.addEventListener('click', e => {
            document.querySelectorAll('[data-ratio]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentRatio = e.target.getAttribute('data-ratio');
            applyResolution(currentRatio);
            const map = { '9-16': { w: '320px', h: '568px', ar: '9 / 16' }, '1-1': { w: '450px', h: '450px', ar: '1 / 1' }, '16-9': { w: '800px', h: '450px', ar: '16 / 9' } };
            const s = map[currentRatio];
            canvasContainer.style.width = s.w; canvasContainer.style.height = s.h; canvasContainer.style.aspectRatio = s.ar;
            draw(); renderSceneList(); requestAnimationFrame(() => renderSceneThumbnails());
        });
    });

    document.querySelectorAll('[data-bg]').forEach(btn => {
        btn.addEventListener('click', e => {
            document.querySelectorAll('[data-bg]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const bg = e.target.getAttribute('data-bg');
            getActiveScene().background = bg;
            if (bg === '#000000' || bg === 'sunset-radial') canvasGridOverlay.classList.add('dark-mode');
            else canvasGridOverlay.classList.remove('dark-mode');
            draw(); refreshSceneThumbnails();
        });
    });

    btnToggleGrid.addEventListener('click', () => {
        btnToggleGrid.classList.toggle('active');
        canvasGridOverlay.style.display = btnToggleGrid.classList.contains('active') ? 'block' : 'none';
    });

    // ── RECORDING (ALL SCENES + TRANSITIONS) ──────────────────
    btnRecord.addEventListener('click', () => { if (!isRecording) startRecording(); });

    function startRecording() {
        saveActiveLayerFromUI();
        pause(); currentTime = 0; syncTimeline(); draw();
        isRecording = true; recordedChunks = [];
        systemDot.classList.add('recording');
        statusText.textContent = 'RECORDING';
        btnRecord.setAttribute('disabled', 'true');
        btnRecord.style.opacity = '0.5';
        canvasContainer.classList.add('glowing-border');
        showToast('Rendering all scenes + transitions… please wait.');

        const REC_FPS = 60;
        const stream  = canvas.captureStream(REC_FPS);
        let opts = { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 25_000_000 };
        if (!MediaRecorder.isTypeSupported(opts.mimeType)) opts = { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 25_000_000 };
        if (!MediaRecorder.isTypeSupported(opts.mimeType)) opts = { mimeType: 'video/webm', videoBitsPerSecond: 25_000_000 };

        mediaRecorder = new MediaRecorder(stream, opts);
        mediaRecorder.ondataavailable = e => { if (e.data?.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.onstop = finishRecording;

        requestAnimationFrame(() => {
            mediaRecorder.start();
            const STEP = 1 / REC_FPS;
            let recSceneIdx = 0;
            let recTime     = 0;
            let recInTr     = false;
            let recTrTime   = 0;

            function renderRecordingFrame() {
                if (!isRecording) return;

                if (recInTr) {
                    const tr = transitions[recSceneIdx];
                    const tp = tr.duration > 0 ? recTrTime / tr.duration : 1;
                    drawTransitionFrame(tr, Math.max(0, Math.min(1, tp)), scenes[recSceneIdx], scenes[recSceneIdx + 1]);
                    currentTime = computeSceneDuration(scenes[recSceneIdx]);
                    activeSceneIdx = recSceneIdx;
                    recTrTime += STEP;
                    if (recTrTime >= tr.duration) {
                        recInTr = false; recTrTime = 0; recSceneIdx++; recTime = 0;
                        if (recSceneIdx >= scenes.length) { stopRecording(); return; }
                    }
                } else {
                    const sceneDur = computeSceneDuration(scenes[recSceneIdx]);
                    if (recTime >= sceneDur) {
                        // Check if there's a real transition next
                        const tr = transitions[recSceneIdx];
                        if (tr && tr.type !== 'cut' && tr.duration > 0 && recSceneIdx < scenes.length - 1) {
                            recInTr = true; recTrTime = 0;
                        } else {
                            recSceneIdx++; recTime = 0;
                            if (recSceneIdx >= scenes.length) { stopRecording(); return; }
                        }
                        requestAnimationFrame(renderRecordingFrame); return;
                    }
                    drawScene(scenes[recSceneIdx], recTime);
                    currentTime = recTime; activeSceneIdx = recSceneIdx; syncTimeline();
                    recTime += STEP;
                }
                requestAnimationFrame(renderRecordingFrame);
            }
            requestAnimationFrame(renderRecordingFrame);
        });
    }

    function stopRecording() { if (mediaRecorder?.state !== 'inactive') mediaRecorder.stop(); }

    function finishRecording() {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url  = URL.createObjectURL(blob);
        exportVideoPreview.src = url;
        btnDownloadVideo.onclick = () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = `rine-studio-${scenes.length}scenes-${Date.now()}.webm`;
            a.click(); showToast('Video downloaded.');
        };
        exportModal.classList.add('active');
        isRecording = false;
        systemDot.classList.remove('recording');
        statusText.textContent = 'SYS_OK';
        btnRecord.removeAttribute('disabled');
        btnRecord.style.opacity = '1';
        canvasContainer.classList.remove('glowing-border');
        switchToScene(0);
        showToast('Render complete — all scenes + transitions captured.');
    }

    btnCloseModal.addEventListener('click', () => { exportModal.classList.remove('active'); exportVideoPreview.src = ''; });
    exportModal.addEventListener('click', e => { if (e.target === exportModal) { exportModal.classList.remove('active'); exportVideoPreview.src = ''; } });

    // ── INIT ──────────────────────────────────────────────────
    renderLayerList();
    loadLayerIntoUI(scenes[0].layers[0]);
    loadSceneBgIntoUI(scenes[0]);
    renderSceneList();
    syncTimeline();
    draw();
    document.fonts.load('400 48px Syne').then(() => {
        draw();
        renderSceneThumbnails();
        requestAnimationFrame(() => renderMiniTimeline(scenes[0], 0));
    });
});
