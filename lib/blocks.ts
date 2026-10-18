export const GRID_SIZE = 100;

export type BlockKind = 'neon' | 'vapor' | 'terminal' | 'synth' | 'cyber';

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

// Setiap blok berukuran seragam 10x10 sel, diposisikan sesuai koordinat, tanpa overlap.
export const DUMMY_BLOCKS: DummyBlock[] = [
  { id: 'b1', name: 'Neon Grid', kind: 'neon', color: '#22d3ee', rows: [0, 9], cols: [0, 9], author: 'jhondurux', url: 'https://example.com/b1' },
  { id: 'b2', name: 'Vapor Synth', kind: 'synth', color: '#a855f7', rows: [0, 9], cols: [10, 19], author: 'synthwave', url: 'https://example.com/b2' },
  { id: 'b3', name: 'Cyber Terminal', kind: 'terminal', color: '#4ade80', rows: [0, 9], cols: [20, 29], author: 'terminal', url: 'https://example.com/b3' },
  { id: 'b4', name: 'Pixel Rain', kind: 'neon', color: '#38bdf8', rows: [0, 9], cols: [30, 39], author: 'pixelfan', url: 'https://example.com/b4' },
  { id: 'b5', name: 'Laser Beam', kind: 'vapor', color: '#f472b6', rows: [0, 9], cols: [40, 49], author: 'laser', url: 'https://example.com/b5' },
  { id: 'b6', name: 'Glitch Zone', kind: 'cyber', color: '#facc15', rows: [10, 19], cols: [0, 9], author: 'glitch', url: 'https://example.com/b6' },
  { id: 'b7', name: 'Synth Loop', kind: 'synth', color: '#c084fc', rows: [10, 19], cols: [10, 19], author: 'music', url: 'https://example.com/b7' },
  { id: 'b8', name: 'Data Stream', kind: 'terminal', color: '#2dd4bf', rows: [10, 19], cols: [20, 29], author: 'stream', url: 'https://example.com/b8' },
  { id: 'b9', name: 'Neon Sunset', kind: 'neon', color: '#fb7185', rows: [10, 19], cols: [30, 39], author: 'sunset', url: 'https://example.com/b9' },
  { id: 'b10', name: 'Vapor Drive', kind: 'vapor', color: '#fbbf24', rows: [10, 19], cols: [40, 49], author: 'retro', url: 'https://example.com/b10' },
  { id: 'b11', name: 'Cyber Cat', kind: 'cyber', color: '#34d399', rows: [20, 29], cols: [0, 9], author: 'cat', url: 'https://example.com/b11' },
  { id: 'b12', name: 'Terminal 8', kind: 'terminal', color: '#60a5fa', rows: [20, 29], cols: [10, 19], author: 'term8', url: 'https://example.com/b12' },
  { id: 'b13', name: 'Synthwave 2000', kind: 'synth', color: '#e879f9', rows: [20, 29], cols: [20, 29], author: 'y2k', url: 'https://example.com/b13' },
  { id: 'b14', name: 'Laser Grid', kind: 'neon', color: '#22d3ee', rows: [20, 29], cols: [30, 39], author: 'grid', url: 'https://example.com/b14' },
  { id: 'b15', name: 'Vapor Cloud', kind: 'vapor', color: '#f97316', rows: [20, 29], cols: [40, 49], author: 'cloud', url: 'https://example.com/b15' },
];

export const CANVAS_BG = '#0f172a';
export const CANVAS_GRID = 'rgba(34, 211, 238, 0.10)';
export const CANVAS_BORDER = '#22d3ee';

// Statistik untuk UI user
export const TOTAL_CELLS = GRID_SIZE * GRID_SIZE; // 10.000
export const BLOCK_SIZE = 10; // sel per sisi untuk satu blok
export const FILLED_CELLS = DUMMY_BLOCKS.length * BLOCK_SIZE * BLOCK_SIZE; // sel yang terisi
