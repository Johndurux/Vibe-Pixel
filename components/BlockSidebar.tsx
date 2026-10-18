import { DUMMY_BLOCKS } from '@/lib/blocks';

export default function BlockSidebar() {
  return (
    <aside className="w-72 shrink-0 border-l border-vibe-secondary/20 bg-vibe-surface/50 overflow-y-auto max-h-[calc(100vh-120px)]">
      <div className="p-4">
        <h2 className="text-lg font-bold text-vibe-accent mb-2 font-mono">
          BLOCKS ({DUMMY_BLOCKS.length})
        </h2>
        <ul className="space-y-2">
          {DUMMY_BLOCKS.map((block) => (
            <li key={block.id} className="text-sm">
              <a
                href={block.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded hover:bg-vibe-accent/10 transition"
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: block.color }}
                />
                <span className="text-vibe-dark/80 font-mono truncate">
                  {block.name}
                </span>
              </a>
              <p className="text-xs text-vibe-dark/50 ml-5 font-mono">
                {block.author} · {block.rows[0]}:{block.rows[1]}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
