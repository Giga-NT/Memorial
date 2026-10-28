// Shared default pavement layer profiles. Dimensions are in metres.
// These are practical visualization/estimating presets for a private pedestrian memorial plot,
// not a substitute for a site-specific design based on soil, drainage and expected loads.
const TILE_MATERIALS = ['tile_black','tile_gray','tile_beige','tile_dark','tile_light','tile_marble','tile_red','tile_brown','tile_blue','tile_green'];

const PROFILES = {
    tile: {
        top: { key: 'surface', label: 'Плитка / брусчатка', thickness: 0.06, kind: 'surface' },
        layers: [
            { key: 'bedding_sand', label: 'Песчаная постель', thickness: 0.04, kind: 'sand', color: 0xd8c18b },
            { key: 'crushed_stone', label: 'Щебёночное основание', thickness: 0.15, kind: 'gravel', color: 0x777777 },
            { key: 'geotextile', label: 'Геотекстиль', thickness: 0.002, kind: 'geotextile', color: 0x4d5555 }
        ]
    },
    gravel: {
        top: { key: 'surface', label: 'Декоративный гравий', thickness: 0.05, kind: 'surface' },
        layers: [
            { key: 'bedding_sand', label: 'Выравнивающий песчаный слой', thickness: 0.03, kind: 'sand', color: 0xd8c18b },
            { key: 'crushed_stone', label: 'Уплотнённое щебёночное основание', thickness: 0.15, kind: 'gravel', color: 0x777777 },
            { key: 'geotextile', label: 'Разделительный геотекстиль', thickness: 0.002, kind: 'geotextile', color: 0x4d5555 }
        ]
    },
    sand: {
        top: { key: 'surface', label: 'Песчаное покрытие', thickness: 0.05, kind: 'surface' },
        layers: [
            { key: 'crushed_stone', label: 'Уплотнённое щебёночное основание', thickness: 0.15, kind: 'gravel', color: 0x777777 },
            { key: 'geotextile', label: 'Разделительный геотекстиль', thickness: 0.002, kind: 'geotextile', color: 0x4d5555 }
        ]
    },
    marble_chips: {
        top: { key: 'surface', label: 'Мраморная крошка', thickness: 0.04, kind: 'surface' },
        layers: [
            { key: 'bedding_sand', label: 'Выравнивающий песчаный слой', thickness: 0.03, kind: 'sand', color: 0xd8c18b },
            { key: 'crushed_stone', label: 'Щебёночное основание', thickness: 0.10, kind: 'gravel', color: 0x777777 },
            { key: 'geotextile', label: 'Разделительный геотекстиль', thickness: 0.002, kind: 'geotextile', color: 0x4d5555 }
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

export function getSiteSurfaceProfile(material = 'tile_gray') {
    const key = TILE_MATERIALS.includes(material) ? 'tile' : (PROFILES[material] ? material : 'tile');
    const profile = PROFILES[key];
    return {
        type: key,
        top: { ...profile.top },
        layers: profile.layers.map(layer => ({ ...layer }))
    };
}

export function getSiteSurfaceLayerTotals(material, area) {
    const profile = getSiteSurfaceProfile(material);
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
