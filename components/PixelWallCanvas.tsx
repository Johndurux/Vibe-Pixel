import { useEffect, useRef } from 'react';
import { DUMMY_BLOCKS, GRID_SIZE, CELL_SIZE, getCanvasColors, getBlockColor, DummyBlock } from '@/lib/blocks';

export default function PixelWallCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { background, grid } = getCanvasColors();

    const draw = () => {
      const width = GRID_SIZE * CELL_SIZE;
      const height = GRID_SIZE * CELL_SIZE;

      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID_SIZE; i += 2) {
        // Vertical
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE + 0.5, 0);
        ctx.lineTo(i * CELL_SIZE + 0.5, height);
        ctx.stroke();
        // Horizontal
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE + 0.5);
        ctx.lineTo(width, i * CELL_SIZE + 0.5);
        ctx.stroke();
      }

      // Blocks
      for (const block of DUMMY_BLOCKS) {
        const color = block.color || getBlockColor(block.kind);
        ctx.fillStyle = color;
        const x = block.cols[0] * CELL_SIZE;
        const y = block.rows[0] * CELL_SIZE;
        const w = (block.cols[1] - block.cols[0] + 1) * CELL_SIZE;
        const h = (block.rows[1] - block.rows[0] + 1) * CELL_SIZE;
        ctx.fillRect(x, y, w, h);

        // Neon glow border
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(block.name, x + 6, y + 14);
      }
    };

    draw();

    const observer = new ResizeObserver(draw);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full object-contain"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
