// Shared default pavement layer profiles. Dimensions are in metres.
// These are practical visualization/estimating presets for a private pedestrian memorial plot,
// not a substitute for a site-specific design based on soil, drainage and expected loads.
const TILE_MATERIALS = ['tile_black','tile_gray','tile_beige','tile_dark','tile_light','tile_marble','tile_red','tile_brown','tile_blue','tile_green'];

const PROFILES = {
    slab: {
        top: { key: 'surface', label: 'Тротуарная плитка', thickness: 0.04, kind: 'surface' },
        layers: [
            { key: 'bedding_sand', label: 'Песчаная постель', thickness: 0.03, kind: 'sand', color: 0xd8c18b },
            { key: 'screenings', label: 'Выравнивающий отсев', thickness: 0.01, kind: 'screenings', color: 0x99958b },
            { key: 'crushed_stone', label: 'Щебёночное основание', thickness: 0.12, kind: 'gravel', color: 0x686868 },
            { key: 'geotextile', label: 'Разделительный геотекстиль (при необходимости)', thickness: 0.002, kind: 'geotextile', color: 0x4d5555 }
        ]
    },
    // Pedestrian paving preset: 60 mm paver, >=30 mm sand bedding,
    // granular base and levelling/wedging layers. Adjust for soil and drainage.
    tile: {
        top: { key: 'surface', label: 'Брусчатка', thickness: 0.06, kind: 'surface' },
        layers: [
            { key: 'bedding_sand', label: 'Песчаная постель', thickness: 0.03, kind: 'sand', color: 0xd8c18b },
            { key: 'screenings', label: 'Верхний слой расклинцовки / отсев', thickness: 0.01, kind: 'screenings', color: 0x99958b },
            { key: 'wedging_stone', label: 'Щебень для расклинцовки', thickness: 0.02, kind: 'gravel', color: 0x858585 },
            { key: 'crushed_stone', label: 'Нижний щебёночный слой', thickness: 0.10, kind: 'gravel', color: 0x686868 },
            { key: 'geotextile', label: 'Разделительный геотекстиль (при необходимости)', thickness: 0.002, kind: 'geotextile', color: 0x4d5555 }
        ]
    },
    // Decorative gravel surface over a compacted, graded granular base.
    gravel: {
        top: { key: 'surface', label: 'Декоративный гравий', thickness: 0.04, kind: 'surface' },
        layers: [
            { key: 'screenings', label: 'Верхний слой расклинцовки / отсев', thickness: 0.01, kind: 'screenings', color: 0x99958b },
            { key: 'wedging_stone', label: 'Щебень для расклинцовки', thickness: 0.02, kind: 'gravel', color: 0x858585 },
            { key: 'crushed_stone', label: 'Нижний щебёночный слой', thickness: 0.10, kind: 'gravel', color: 0x686868 },
            { key: 'geotextile', label: 'Разделительный геотекстиль (при необходимости)', thickness: 0.002, kind: 'geotextile', color: 0x4d5555 }
        ]
    },
    sand: {
        top: { key: 'surface', label: 'Песчаное покрытие', thickness: 0.05, kind: 'surface' },
        layers: [
            { key: 'crushed_stone', label: 'Уплотнённое щебёночное основание', thickness: 0.10, kind: 'gravel', color: 0x686868 },
            { key: 'geotextile', label: 'Разделительный геотекстиль (при необходимости)', thickness: 0.002, kind: 'geotextile', color: 0x4d5555 }
        ]
    },
    marble_chips: {
        top: { key: 'surface', label: 'Мраморная крошка', thickness: 0.04, kind: 'surface' },
        layers: [
            { key: 'bedding_sand', label: 'Выравнивающий песчаный слой', thickness: 0.03, kind: 'sand', color: 0xd8c18b },
            { key: 'screenings', label: 'Выравнивающий отсев', thickness: 0.01, kind: 'screenings', color: 0x99958b },
            { key: 'crushed_stone', label: 'Щебёночное основание', thickness: 0.10, kind: 'gravel', color: 0x686868 },
            { key: 'geotextile', label: 'Разделительный геотекстиль (при необходимости)', thickness: 0.002, kind: 'geotextile', color: 0x4d5555 }
        ]
    },
    grass: {
        top: { key: 'surface', label: 'Газонный грунт', thickness: 0.10, kind: 'surface' },
        layers: [
            { key: 'subsoil', label: 'Подготовленный грунт', thickness: 0.15, kind: 'soil', color: 0x76543a }
        ]
    },
    flowers: {
        top: { key: 'surface', label: 'Растительный грунт', thickness: 0.10, kind: 'surface' },
        layers: [
            { key: 'subsoil', label: 'Подготовленный грунт', thickness: 0.15, kind: 'soil', color: 0x76543a }
        ]
    }
};

export function getSiteSurfaceProfile(material = 'tile_gray', surfaceType = 'paver', topThicknessOverride = null) {
    const key = TILE_MATERIALS.includes(material) ? (surfaceType === 'slab' ? 'slab' : 'tile') : (PROFILES[material] ? material : (surfaceType === 'slab' ? 'slab' : 'tile'));
    const profile = PROFILES[key];
    const top = { ...profile.top };
    const requestedThickness = Number(topThicknessOverride);
    if (surfaceType !== 'slab' && Number.isFinite(requestedThickness) && requestedThickness >= 0.04 && requestedThickness <= 0.08) {
        top.thickness = requestedThickness;
    }
    return {
        type: key,
        top,
        layers: profile.layers.map(layer => ({ ...layer }))
    };
}

export function getSiteSurfaceLayerTotals(material, area, surfaceType = 'paver') {
    const profile = getSiteSurfaceProfile(material, surfaceType);
    return {
        profile,
        topArea: Math.max(0, Number(area) || 0),
        layers: profile.layers.map(layer => ({
            ...layer,
            area: Math.max(0, Number(area) || 0),
            volume: Math.max(0, Number(area) || 0) * layer.thickness
        }))
    };
}
