export const GRID_SIZE = 100;

export type BlockKind = 'launchpad' | 'builder' | 'community' | 'tool' | 'game';

export interface DummyBlock {
  id: string;
  name: string;
  kind: BlockKind;
  color: string;
  rows: [number, number]; // [start, end]
  cols: [number, number];
  author: string;
  url: string;
}

// 15 blok, masing-masing SATU unit grid tunggal (10x10 px), tersebar di seluruh
// grid 100x100. Tidak ada lapisan "sel vs blok" — 1 blok = 1 unit grid.
// Colors are flat/sticker-like: warm paper tones, no neon/glow.
export const DUMMY_BLOCKS: DummyBlock[] = [
  { id: 'b1', name: 'VibeLaunch', kind: 'launchpad', color: '#FF5A36', rows: [8, 8], cols: [12, 12], author: 'vibeteam', url: 'https://testnet.vibevibe.fun' },
  { id: 'b2', name: 'PixelDAO', kind: 'community', color: '#FFD23F', rows: [15, 15], cols: [47, 47], author: 'dao', url: 'https://example.com/b2' },
  { id: 'b3', name: 'ChainCanvas', kind: 'tool', color: '#6B9AC4', rows: [6, 6], cols: [83, 83], author: 'chainart', url: 'https://example.com/b3' },
  { id: 'b4', name: 'MemeMint', kind: 'game', color: '#A8D08D', rows: [28, 28], cols: [20, 20], author: 'memer', url: 'https://example.com/b4' },
  { id: 'b5', name: 'BuilderHub', kind: 'builder', color: '#F4A261', rows: [33, 33], cols: [58, 58], author: 'builder', url: 'https://example.com/b5' },
  { id: 'b6', name: 'TokenTrek', kind: 'game', color: '#E67E80', rows: [22, 22], cols: [91, 91], author: 'trek', url: 'https://example.com/b6' },
  { id: 'b7', name: 'VibeSDK', kind: 'tool', color: '#8ECAE6', rows: [41, 41], cols: [6, 6], author: 'sdk', url: 'https://example.com/b7' },
  { id: 'b8', name: 'StickerSwap', kind: 'community', color: '#D4A5D4', rows: [48, 48], cols: [38, 38], author: 'swap', url: 'https://example.com/b8' },
  { id: 'b9', name: 'RocketRaid', kind: 'game', color: '#FF9F1C', rows: [44, 44], cols: [72, 72], author: 'rocket', url: 'https://example.com/b9' },
  { id: 'b10', name: 'LaunchLab', kind: 'launchpad', color: '#FF5A36', rows: [63, 63], cols: [17, 17], author: 'lab', url: 'https://example.com/b10' },
  { id: 'b11', name: 'CodeCanvas', kind: 'builder', color: '#6B9AC4', rows: [58, 58], cols: [54, 54], author: 'code', url: 'https://example.com/b11' },
  { id: 'b12', name: 'PixelPark', kind: 'community', color: '#A8D08D', rows: [69, 69], cols: [88, 88], author: 'park', url: 'https://example.com/b12' },
  { id: 'b13', name: 'ArtChain', kind: 'tool', color: '#F4A261', rows: [80, 80], cols: [10, 10], author: 'art', url: 'https://example.com/b13' },
  { id: 'b14', name: 'DegenDen', kind: 'game', color: '#E67E80', rows: [85, 85], cols: [45, 45], author: 'degen', url: 'https://example.com/b14' },
  { id: 'b15', name: 'VibeVault', kind: 'launchpad', color: '#8ECAE6', rows: [90, 90], cols: [76, 76], author: 'vault', url: 'https://example.com/b15' },
];

// Paper/ink palette for canvas
export const CANVAS_BG = '#F2EADF';      // paper warm cream
export const CANVAS_GRID = 'rgba(22, 20, 15, 0.08)'; // subtle ink grid
export const CANVAS_BORDER = '#16140F';  // ink border

// Statistik untuk UI user
export const TOTAL_CELLS = GRID_SIZE * GRID_SIZE; // 10.000 (= total blok, 1 blok = 1 sel)
