const FONT_NAMES = [
    'Yermak',
    'Bodega Script',
    'Brusher',
    'Drevnerusskij',
    'Drina',
    'DS-BroadBrush',
    'Federico',
    'Feofan',
    'Figurny',
    'Pochaevsk',
    'Remeslo',
    'Tsarevich'
];

function normalizeText(value) {
    return typeof value === 'string'
        ? value.replace(/\r\n?/g, '\n').trim()
        : '';
}

function splitLines(value) {
    return normalizeText(value)
        .split('\n')
        .flatMap(line => line.split('/'))
        .map(line => line.trim())
        .filter(Boolean);
}

export function resolveEpitaphFontFamily(fontFamily) {
    const value = String(fontFamily || 'Arial, sans-serif');
    return FONT_NAMES.find(name => value.includes(name)) || value;
}

function getEpitaphItem(item) {
    if (typeof item === 'string') {
        return { text: item, offsetX: 0, offsetY: 0 };
    }

    return {
        text: typeof item?.text === 'string' ? item.text : '',
        offsetX: Number(item?.offsetX) || 0,
        offsetY: Number(item?.offsetY) || 0
    };
}

export function collectBackEpitaphs(data = {}) {
    const source = data || {};
    const blocks = [];
    const burials = Array.isArray(source.burials) ? source.burials : [];

    burials.forEach((burial, burialIndex) => {
        if (!burial) return;

        const burialId = burial.id ?? `burial-${burialIndex}`;

        if (normalizeText(burial.epitaph)) {
            blocks.push({
                text: burial.epitaph,
                burialId,
                epitaphIndex: 0,
                key: `${burialId}:0`,
                fontSize: Number(burial.epitaphFontSize) || 0,
                offsetX: Number(burial.epitaphOffsetX) || 0,
                offsetY: Number(burial.epitaphOffsetY) || 0
            });
        }

        if (Array.isArray(burial.epitaphs)) {
            burial.epitaphs.forEach((rawItem, itemIndex) => {
                const item = getEpitaphItem(rawItem);
                if (!normalizeText(item.text)) return;

                blocks.push({
                    text: item.text,
                    burialId,
                    epitaphIndex: itemIndex + 1,
                    key: `${burialId}:${itemIndex + 1}`,
                    fontSize: Number(burial.epitaphFontSize) || 0,
                    offsetX: item.offsetX,
                    offsetY: item.offsetY
                });
            });
        }
    });

    if (blocks.length === 0 && normalizeText(source.epitaph)) {
        blocks.push({
            text: source.epitaph,
            burialId: source.activeBurialId ?? 'default',
            epitaphIndex: 0,
            key: `${source.activeBurialId ?? 'default'}:0`,
            fontSize: 0,
            offsetX: Number(source.epitaphOffsetX) || 0,
            offsetY: Number(source.epitaphOffsetY) || 0
        });
    }

    return blocks;
}

function findBurial(data, burialId) {
    if (!Array.isArray(data?.burials) || data.burials.length === 0) {
        return null;
    }

    return data.burials.find((burial, index) => {
        const id = burial?.id ?? `burial-${index}`;
        return String(id) === String(burialId);
    }) || null;
}

export function getEpitaphBlockOffset(data, burialId, epitaphIndex = 0) {
    const burial = findBurial(data, burialId);

    if (!burial) {
        return {
            x: Number(data?.epitaphOffsetX) || 0,
            y: Number(data?.epitaphOffsetY) || 0
        };
    }

    if (epitaphIndex <= 0) {
        return {
            x: Number(burial.epitaphOffsetX) || 0,
            y: Number(burial.epitaphOffsetY) || 0
        };
    }

    const item = getEpitaphItem(burial.epitaphs?.[epitaphIndex - 1]);

    return { x: item.offsetX, y: item.offsetY };
}

export function setEpitaphBlockOffset(
    data,
    burialId,
    epitaphIndex = 0,
    x = 0,
    y = 0
) {
    const burial = findBurial(data, burialId);

    if (!burial) {
        data.epitaphOffsetX = x;
        data.epitaphOffsetY = y;
        return;
    }

    if (epitaphIndex <= 0) {
        burial.epitaphOffsetX = x;
        burial.epitaphOffsetY = y;
        return;
    }

    if (!Array.isArray(burial.epitaphs)) {
        burial.epitaphs = [];
    }

    const itemIndex = epitaphIndex - 1;
    burial.epitaphs[itemIndex] = {
        ...getEpitaphItem(burial.epitaphs[itemIndex]),
        offsetX: x,
        offsetY: y
    };
}

const activeEpitaphSelection = {
    burialId: null,
    epitaphIndex: 0
};

function getActiveDataState() {
    if (typeof window === 'undefined') return null;

    const manager = window.multiMonumentManager;

    if (manager?.currentMode === 'duplicator' && manager.activeIndex >= 0) {
        return manager.monuments?.[manager.activeIndex]?.data ||
            window.state ||
            null;
    }

    return window.state || null;
}

export function selectEpitaphBlock(burialId, epitaphIndex = 0) {
    activeEpitaphSelection.burialId = burialId ?? null;
    activeEpitaphSelection.epitaphIndex = Number(epitaphIndex) || 0;
    updateEpitaphSelectionLabel();
    updateEpitaphOffsetDisplay();

    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent('epitaph-selection-changed', {
            detail: { ...activeEpitaphSelection }
        }));
    }
}

export function getActiveEpitaphSelection() {
    return { ...activeEpitaphSelection };
}

export function updateEpitaphSelectionLabel() {
    if (typeof document === 'undefined') return;

    const label = document.getElementById('activeEpitaphLabel');
    if (!label) return;

    const { burialId, epitaphIndex } = activeEpitaphSelection;
    if (burialId == null) {
        label.textContent = 'основная эпитафия';
        return;
    }

    const burial = findBurial(getActiveDataState(), burialId);

    const personName = burial?.fullName?.trim() || 'человек';
    const suffix = epitaphIndex > 0
        ? `доп. ${epitaphIndex}`
        : 'основная';

    label.textContent = `${personName} — ${suffix}`;
}

export function updateEpitaphOffsetDisplay() {
    if (typeof document === 'undefined') return;

    const xVal = document.getElementById('epitaphOffsetXVal');
    const yVal = document.getElementById('epitaphOffsetYVal');

    if (!xVal && !yVal) return;

    const { burialId, epitaphIndex } = activeEpitaphSelection;
    const offset = getEpitaphBlockOffset(
        getActiveDataState(),
        burialId,
        epitaphIndex
    );

    if (xVal) xVal.textContent = offset.x.toFixed(2);
    if (yVal) yVal.textContent = offset.y.toFixed(2);
}

export function hasBackEpitaphs(data = {}) {
    return collectBackEpitaphs(data).length > 0;
}

export function buildBackEpitaphLayout(data = {}, options = {}) {
    if (typeof document === 'undefined') return [];

    const blocks = collectBackEpitaphs(data);
    if (blocks.length === 0) return [];

    const isMobile = options.isMobile ??
        (typeof window !== 'undefined' && window.innerWidth < 768);
    const baseFontSize = Number(data.epitaphFontSize) || 40;
    const fontScale = isMobile ? 0.8 : 1.2;
    const lineHeightFactor = isMobile ? 0.9 : 1.5;
    const fontFamily = resolveEpitaphFontFamily(data.fontFamily);
    const decalWidth = Number(options.decalWidth) || 1;
    const decalHeight = Number(options.decalHeight) || 1;
    const worldPerPx = decalHeight / 1024;
    const paddingX = isMobile ? 18 : 34;
    const paddingY = isMobile ? 10 : 16;
    const gapPx = isMobile ? 18 : 30;
    const topPaddingPx = isMobile ? 48 : 80;
    const bottomPaddingPx = isMobile ? 48 : 80;
    const maxCanvasWidth = Math.max(
        64,
        Math.min(
            1024,
            Math.floor(decalWidth / worldPerPx)
        )
    );
    const maxTextWidth = Math.max(32, maxCanvasWidth - paddingX * 2);
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');

    const measured = blocks
        .map(block => {
            const lines = splitLines(block.text);
            if (lines.length === 0) return null;

            let fontSize = (Number(block.fontSize) || baseFontSize) * fontScale;
            let lineHeight = fontSize * lineHeightFactor;
            let maxLineWidth = 0;

            measureCtx.font = `bold ${fontSize}px ${fontFamily}`;
            lines.forEach(line => {
                maxLineWidth = Math.max(
                    maxLineWidth,
                    measureCtx.measureText(line).width
                );
            });

            let blockScale = 1;
            if (maxLineWidth > maxTextWidth) {
                blockScale = maxTextWidth / maxLineWidth;
                fontSize *= blockScale;
                lineHeight *= blockScale;
                maxLineWidth = maxTextWidth;
            }

            return {
                ...block,
                lines,
                fontSize,
                lineHeight,
                maxLineWidth,
                widthPx: Math.ceil(maxLineWidth + paddingX * 2),
                heightPx: Math.ceil(
                    lines.length * lineHeight + paddingY * 2
                )
            };
        })
        .filter(Boolean);

    if (measured.length === 0) return [];

    const availableHeightPx = Math.max(
        1,
        1024 - topPaddingPx - bottomPaddingPx
    );
    const totalHeightPx = measured.reduce(
        (sum, block, index) =>
            sum + block.heightPx + (index < measured.length - 1 ? gapPx : 0),
        0
    );
    const fitScale = totalHeightPx > availableHeightPx
        ? availableHeightPx / totalHeightPx
        : 1;

    let topPx = topPaddingPx;

    return measured.map(block => {
        const fontSize = block.fontSize * fitScale;
        const lineHeight = block.lineHeight * fitScale;
        const widthPx = Math.max(
            1,
            Math.ceil(block.maxLineWidth * fitScale + paddingX * 2)
        );
        const heightPx = Math.max(
            1,
            Math.ceil(
                block.lines.length * lineHeight + paddingY * 2
            )
        );
        const canvas = document.createElement('canvas');
        canvas.width = widthPx;
        canvas.height = heightPx;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = data.textColor || '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = isMobile ? 3 : 6;
        ctx.font = `bold ${fontSize}px ${fontFamily}`;

        block.lines.forEach((line, lineIndex) => {
            ctx.fillText(
                line,
                canvas.width / 2,
                paddingY + lineHeight * (lineIndex + 0.5)
            );
        });

        const defaultCenterY = decalHeight / 2 -
            (topPx + heightPx / 2) * worldPerPx;

        topPx += heightPx + gapPx * fitScale;

        return {
            ...block,
            canvas,
            fontSize,
            lineHeight,
            widthPx,
            heightPx,
            worldWidth: widthPx * worldPerPx,
            worldHeight: heightPx * worldPerPx,
            defaultCenterX: 0,
            defaultCenterY
        };
    });
}

export function drawBackEpitaphs(ctx, canvas, data = {}, options = {}) {
    const blocks = collectBackEpitaphs(data);
    if (blocks.length === 0) return false;

    const isMobile = options.isMobile ??
        (typeof window !== 'undefined' && window.innerWidth < 768);
    const baseFontSize = Number(data.epitaphFontSize) || 40;
    const fontScale = isMobile ? 0.8 : 1.2;
    const lineHeightFactor = isMobile ? 0.9 : 1.5;
    const blockGap = isMobile ? 18 : 30;
    const fontFamily = resolveEpitaphFontFamily(data.fontFamily);
    const pixelsPerMeter = canvas.height / 1.2;
    const offsetX = (Number(data.epitaphOffsetX) || 0) * pixelsPerMeter;
    const offsetY = (Number(data.epitaphOffsetY) || 0) * pixelsPerMeter;
    const centerX = canvas.width / 2 + offsetX;

    const measured = [];

    blocks.forEach(block => {
        const lines = splitLines(block.text);
        if (lines.length === 0) return;

        const sourceSize = Number(block.fontSize) || baseFontSize;
        measured.push({
            lines,
            fontSize: sourceSize * fontScale,
            lineHeight: sourceSize * lineHeightFactor
        });
    });

    if (measured.length === 0) return false;

    const totalHeight = measured.reduce(
        (sum, block, index) =>
            sum + block.lines.length * block.lineHeight +
            (index < measured.length - 1 ? blockGap : 0),
        0
    );

    const availableHeight = Math.max(1, canvas.height - 160);
    const fitScale = totalHeight > availableHeight
        ? availableHeight / totalHeight
        : 1;

    ctx.fillStyle = data.textColor || '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = isMobile ? 3 : 6;

    let currentY = 80 + offsetY;

    measured.forEach((block, blockIndex) => {
        ctx.font = `bold ${block.fontSize * fitScale}px ${fontFamily}`;

        block.lines.forEach(line => {
            ctx.fillText(line, centerX, currentY);
            currentY += block.lineHeight * fitScale;
        });

        if (blockIndex < measured.length - 1) {
            currentY += blockGap * fitScale;
        }
    });

    return true;
}
