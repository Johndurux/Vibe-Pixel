'use client';

import { useState } from 'react';
import PixelWallCanvas from '@/components/PixelWallCanvas';
import BlockSidebar from '@/components/BlockSidebar';
import { DUMMY_BLOCKS } from '@/lib/blocks';

export default function Home() {
  const [showSidebar, setShowSidebar] = useState(true);

  return (
    <main className="min-h-screen bg-vibe-dark text-vibe-dark/80 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-vibe-accent/20 bg-vibe-surface/30">
        <h1 className="text-2xl font-bold font-mono text-vibe-accent tracking-widest">
          VIBE PIXEL WALL
        </h1>
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="px-4 py-2 rounded-lg bg-vibe-secondary/20 hover:bg-vibe-secondary/30 transition text-sm font-mono"
        >
          {showSidebar ? 'Sembunyikan Panel' : 'Tampilkan Panel'}
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
          <div className="w-full max-w-4xl aspect-square">
            <PixelWallCanvas />
          </div>
        </div>

        {/* Sidebar */}
        {showSidebar && <BlockSidebar />}
      </div>

      {/* Footer */}
      <footer className="px-6 py-2 text-xs text-vibe-dark/40 font-mono border-t border-vibe-accent/10 flex justify-between">
        <span>100×100 Grid · {DUMMY_BLOCKS.length} Blocks · Dark Neon</span>
        <span>Phase 1 · Static</span>
      </footer>
    </main>
  );
}
