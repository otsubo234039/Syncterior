const concreteSurface = { name: 'コンクリート', image: '/textures/concrete-surface.jpg', color: '#c9c8c4' };

export const surfacePresets = {
  floor: {
    wood: { name: 'ライトウッド', color: '#d5c19c' },
    oak: { name: 'ホワイトウッド', image: '/textures/light-oak-floor.jpg', color: '#d8cfbd' },
    natural: { name: 'ナチュラルウッド', image: '/textures/natural-wood-floor.jpg', color: '#cba66f', rotation: Math.PI / 2 },
    dark: { name: 'ダークウッド', image: '/textures/dark-wood-floor.png', color: '#51301d' },
    tatami: { name: '畳', image: '/textures/tatami-floor.png', color: '#c7b56e' },
    whiteTile: { name: '白タイル', image: '/textures/white-tile-floor.jpg', color: '#e8e7e3' },
    concrete: concreteSurface,
    stone: { name: 'ストーン', color: '#aeb2aa' },
    carpet: { name: 'カーペット', image: '/textures/beige-carpet-floor.jpg', color: '#c4b99e' },
  },
  wall: {
    white: { name: 'ホワイト', image: '/textures/wall-white.png', color: '#f7f4ed' },
    beige: { name: 'ベージュ', image: '/textures/wall-beige.png', color: '#ddd3bd' },
    gray: { name: 'グレー', image: '/textures/wall-gray.png', color: '#c7c7c7' },
    whiteWood: { name: 'ホワイトウッド', image: '/textures/wall-white-wood.png', color: '#eee5d3' },
    naturalWood: { name: 'ナチュラルウッド', image: '/textures/wall-natural-wood.png', color: '#d8b27b' },
    darkWood: { name: 'ダークウッド', image: '/textures/wall-dark-wood.png', color: '#4b3025' },
    concrete: concreteSurface,
  },
};

export const defaultSurfaces = { floor: 'natural', wall: 'white' };

export function isSurfaceSettings(value) {
  return Boolean(value
    && Object.hasOwn(surfacePresets.floor, value.floor)
    && Object.hasOwn(surfacePresets.wall, value.wall)
    && Object.keys(value).every(key => ['floor', 'wall'].includes(key)));
}

export function migrateSurfaceSettings(value) {
  const legacyFloorPresets = { wood: 'natural', stone: 'concrete' };
  const legacyWallPresets = { sage: 'gray' };
  return {
    ...value,
    floor: legacyFloorPresets[value.floor] ?? value.floor,
    wall: legacyWallPresets[value.wall] ?? value.wall,
  };
}
