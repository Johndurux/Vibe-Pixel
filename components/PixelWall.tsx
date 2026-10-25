'use client';

import { memo, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { GRID_SIZE, type WallBlock } from '@/lib/blocks';

interface ViewState {
  scale: number;
  x: number;
  y: number;
}

interface PointerPoint {
  x: number;
  y: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
}

interface PinchState {
  distance: number;
  centerX: number;
  centerY: number;
}

const BASE_CELL = 10;
const BOARD_SIZE = GRID_SIZE * BASE_CELL;
const MAX_SCALE = 4;
const TAP_SLOP = 8;
const WHEEL_IDLE_MS = 160;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const BlockLayer = memo(function BlockLayer({ blocks }: { blocks: WallBlock[] }) {
  return (
    <>
      {blocks.map((block) => {
        const x = block.x * BASE_CELL;
        const y = block.y * BASE_CELL;
        const width = block.w * BASE_CELL;
        const height = block.h * BASE_CELL;

        return (
          <div
            key={block.id}
            data-block-id={block.id}
            data-has-logo={block.logo_url ? 'true' : undefined}
            className="wall-block"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: `${width}px`,
              height: `${height}px`,
              backgroundColor: block.color,
            }}
          >
            {block.logo_url ? (
              <img
                src={block.logo_url}
                alt=""
                className="wall-block-logo"
                draggable={false}
                decoding="async"
                loading="lazy"
              />
            ) : null}
            <span className="wall-block-label">{block.name}</span>
          </div>
        );
      })}
    </>
  );
});

export default function PixelWall({ blocks }: { blocks: WallBlock[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<ViewState>({ scale: 1, x: 0, y: 0 });
  const fitScaleRef = useRef(1);
  const frameRef = useRef<number | null>(null);
  const willChangeTimerRef = useRef<number | null>(null);
  const wheelTimerRef = useRef<number | null>(null);
  const pointersRef = useRef<Map<number, PointerPoint>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const interactedRef = useRef(false);
  const blocksRef = useRef(blocks);

  const [zoomPercent, setZoomPercent] = useState(100);
  const [selected, setSelected] = useState<WallBlock | null>(null);

  useEffect(() => {
    blocksRef.current = blocks;
    setSelected((current) =>
      current ? blocks.find((block) => block.id === current.id) ?? null : null,
    );
  }, [blocks]);

  const applyTransform = () => {
    const board = boardRef.current;
    if (!board) return;

    const view = viewRef.current;
    board.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`;
    board.dataset.zoomed = view.scale >= 2 ? 'true' : 'false';
    board.dataset.labels = view.scale >= 2.2 ? 'true' : 'false';
  };

  const scheduleTransform = () => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      applyTransform();
    });
  };

  const beginGesture = () => {
    const board = boardRef.current;
    if (willChangeTimerRef.current !== null) {
      window.clearTimeout(willChangeTimerRef.current);
      willChangeTimerRef.current = null;
    }
    if (board) board.style.willChange = 'transform';
  };

  const endGesture = () => {
    if (willChangeTimerRef.current !== null) {
      window.clearTimeout(willChangeTimerRef.current);
    }
    willChangeTimerRef.current = window.setTimeout(() => {
      boardRef.current?.style.removeProperty('will-change');
      willChangeTimerRef.current = null;
    }, 60);
  };

  const measureFit = () => {
    const viewport = viewportRef.current;
    if (!viewport) return null;

    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (width < 20 || height < 20) return null;

    const fit = Math.min(width / BOARD_SIZE, height / BOARD_SIZE);
    return { width, height, fit: clamp(fit, 0.1, MAX_SCALE) };
  };

  const fitView = () => {
    const metrics = measureFit();
    if (!metrics) return;

    const scale = metrics.fit;
    fitScaleRef.current = scale;
    viewRef.current = {
      scale,
      x: (metrics.width - BOARD_SIZE * scale) / 2,
      y: 0,
    };
    scheduleTransform();
    setZoomPercent(Math.round(scale * 100));
  };

  const zoomAtPoint = (pointX: number, pointY: number, factor: number) => {
    const view = viewRef.current;
    const nextScale = clamp(view.scale * factor, fitScaleRef.current, MAX_SCALE);
    if (nextScale === view.scale) return;

    const ratio = nextScale / view.scale;
    view.x = pointX - (pointX - view.x) * ratio;
    view.y = pointY - (pointY - view.y) * ratio;
    view.scale = nextScale;
    interactedRef.current = true;
    scheduleTransform();
  };

  const zoomAtCenter = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    zoomAtPoint(viewport.clientWidth / 2, viewport.clientHeight / 2, factor);
    setZoomPercent(Math.round(viewRef.current.scale * 100));
  };

  const pickBlockAt = (clientX: number, clientY: number) => {
    const hit = document.elementFromPoint(clientX, clientY);
    const target = hit instanceof Element ? hit.closest<HTMLElement>('[data-block-id]') : null;
    const id = target?.dataset.blockId;
    return id ? blocksRef.current.find((block) => block.id === id) ?? null : null;
  };

  useIsomorphicLayoutEffect(() => {
    fitView();

    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(() => {
      const metrics = measureFit();
      if (!metrics) return;

      fitScaleRef.current = metrics.fit;
      if (!interactedRef.current) {
        fitView();
        return;
      }

      const view = viewRef.current;
      const nextScale = clamp(view.scale, metrics.fit, MAX_SCALE);
      if (nextScale !== view.scale) {
        const centerX = metrics.width / 2;
        const centerY = metrics.height / 2;
        const ratio = nextScale / view.scale;
        view.x = centerX - (centerX - view.x) * ratio;
        view.y = centerY - (centerY - view.y) * ratio;
        view.scale = nextScale;
        scheduleTransform();
        setZoomPercent(Math.round(nextScale * 100));
      }
    });

    observer.observe(viewport);
    return () => observer.disconnect();
    // fitView intentionally reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0015);
      zoomAtPoint(event.clientX - rect.left, event.clientY - rect.top, factor);
      beginGesture();

      if (wheelTimerRef.current !== null) window.clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = window.setTimeout(() => {
        endGesture();
        setZoomPercent(Math.round(viewRef.current.scale * 100));
        wheelTimerRef.current = null;
      }, WHEEL_IDLE_MS);
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
    // Handlers only touch refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (willChangeTimerRef.current !== null) window.clearTimeout(willChangeTimerRef.current);
      if (wheelTimerRef.current !== null) window.clearTimeout(wheelTimerRef.current);
    };
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    beginGesture();

    if (pointersRef.current.size === 1) {
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
      };
      pinchRef.current = null;
    } else if (pointersRef.current.size === 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      pinchRef.current = {
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        centerX: (first.x + second.x) / 2,
        centerY: (first.y + second.y) / 2,
      };
      dragRef.current = null;
    }

    event.preventDefault();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = pointersRef.current.get(event.pointerId);
    if (!point) return;

    point.x = event.clientX;
    point.y = event.clientY;

    if (pointersRef.current.size >= 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const centerX = (first.x + second.x) / 2;
      const centerY = (first.y + second.y) / 2;
      const previous = pinchRef.current;

      if (previous && previous.distance > 0) {
        const viewport = viewportRef.current;
        if (viewport) {
          const rect = viewport.getBoundingClientRect();
          const pointX = centerX - rect.left;
          const pointY = centerY - rect.top;
          const previousX = previous.centerX - rect.left;
          const previousY = previous.centerY - rect.top;

          viewRef.current.x += pointX - previousX;
          viewRef.current.y += pointY - previousY;
          zoomAtPoint(pointX, pointY, distance / previous.distance);
          interactedRef.current = true;
          scheduleTransform();
        }
      }

      pinchRef.current = { distance, centerX, centerY };
      event.preventDefault();
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (
      Math.abs(event.clientX - drag.startX) > TAP_SLOP ||
      Math.abs(event.clientY - drag.startY) > TAP_SLOP
    ) {
      drag.moved = true;
    }

    if (drag.moved) {
      viewRef.current.x += event.clientX - drag.lastX;
      viewRef.current.y += event.clientY - drag.lastY;
      interactedRef.current = true;
      scheduleTransform();
    }

    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    event.preventDefault();
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>, allowTap: boolean) => {
    const drag = dragRef.current;
    const wasTap =
      allowTap &&
      drag !== null &&
      drag.pointerId === event.pointerId &&
      !drag.moved &&
      pointersRef.current.size === 1;

    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;

    if (pointersRef.current.size === 1) {
      const [pointerId, point] = Array.from(pointersRef.current.entries())[0];
      dragRef.current = {
        pointerId,
        startX: point.x,
        startY: point.y,
        lastX: point.x,
        lastY: point.y,
        moved: true,
      };
    } else if (pointersRef.current.size === 0) {
      dragRef.current = null;
      endGesture();
      setZoomPercent(Math.round(viewRef.current.scale * 100));
    }

    if (wasTap) {
      const block = pickBlockAt(event.clientX, event.clientY);
      if (block) setSelected(block);
    }

    event.preventDefault();
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => zoomAtCenter(1.4)} aria-label="Zoom in" className="btn-sticker">+</button>
          <button onClick={() => zoomAtCenter(1 / 1.4)} aria-label="Zoom out" className="btn-sticker">−</button>
          <button
            onClick={() => {
              interactedRef.current = false;
              fitView();
            }}
            aria-label="Reset view"
            className="btn-sticker"
          >
            ⟲
          </button>
          <span data-testid="zoom-level" className="zoom-badge">{zoomPercent}%</span>
        </div>
      </div>

      <div
        ref={viewportRef}
        data-testid="board-scroll"
        className="wall-viewport relative min-h-0 w-full flex-1 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finishPointer(event, true)}
        onPointerCancel={(event) => finishPointer(event, false)}
      >
        <div
          ref={boardRef}
          data-testid="wall-board"
          className="wall-board absolute left-0 top-0 h-[1000px] w-[1000px] origin-top-left"
        >
          <div className="wall-grid pointer-events-none absolute inset-0" />
          <BlockLayer blocks={blocks} />
        </div>
      </div>

      {selected && (
        <div
          data-testid="selected-detail"
          className="tag-paper flex w-full items-center gap-3"
          style={{ borderColor: '#16140F' }}
        >
          <span className="h-4 w-4 shrink-0 rounded-sm border-2 border-ink" style={{ background: selected.color }} />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-bold" style={{ color: selected.color }}>{selected.name}</div>
            <div className="truncate text-xs text-ink/75">
              {selected.description || (selected.author ? `by ${selected.author}` : 'Community slot')}
            </div>
          </div>
          {selected.link ? (
            <a
              href={selected.link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${selected.name} project in a new tab`}
              className="btn-accent shrink-0 px-3 py-1 text-xs"
            >
              Open
            </a>
          ) : null}
          <button
            onClick={() => setSelected(null)}
            aria-label="Close details"
            className="shrink-0 text-lg font-bold leading-none text-ink/50 hover:text-accent"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
