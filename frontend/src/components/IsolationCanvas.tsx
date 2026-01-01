import { useRef, useEffect, useState, useCallback } from 'react';
import type { IsolationPoint, IsolationPointType } from '../types';
import {
  ISOLATION_POINT_TYPE_COLORS,
  ISOLATION_POINT_STATUS_COLORS
} from '../types';

// Cache buster - version 3.0
console.log('🎯 IsolationCanvas VERSION 3.0 - CUSTOM SHAPES ACTIVE 🎯');

interface IsolationCanvasProps {
  width: number;
  height: number;
  zoom: number;
  points: IsolationPoint[];
  selectedPointId: string | null;
  isLocked: boolean;
  activeTool: IsolationPointType | null;
  pointSize?: number; // Base size for points (default 22)
  onPointClick: (point: IsolationPoint) => void;
  onPointCreate: (x: number, y: number, type: IsolationPointType) => void;
  onPointMove: (pointId: string, x: number, y: number) => void;
}

export function IsolationCanvas({
  width,
  height,
  zoom,
  points,
  selectedPointId,
  isLocked,
  activeTool,
  pointSize = 22,
  onPointClick,
  onPointCreate,
  onPointMove,
}: IsolationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPointId, setDragPointId] = useState<string | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);

  console.log('IsolationCanvas rendered', { width, height, isLocked, activeTool, pointsCount: points.length });

  // Get point at position
  const getPointAtPosition = useCallback((x: number, y: number): IsolationPoint | null => {
    const pointRadius = pointSize + 6; // Base size + status ring
    for (const point of points) {
      const dx = point.x - x;
      const dy = point.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= pointRadius) {
        return point;
      }
    }
    return null;
  }, [points, pointSize]);

  // Draw shape based on point type
  const drawShape = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    pointType: IsolationPointType,
    size: number,
    color: string
  ) => {
    console.log('🎨 Drawing shape:', { pointType, x, y, size, color });
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    switch (pointType) {
      case 'work_point': {
        // Star/Hexagon
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const px = x + size * Math.cos(angle);
          const py = y + size * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'valve': {
        // Circle with X
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Draw X
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        const xSize = size * 0.6;
        ctx.beginPath();
        ctx.moveTo(x - xSize, y - xSize);
        ctx.lineTo(x + xSize, y + xSize);
        ctx.moveTo(x + xSize, y - xSize);
        ctx.lineTo(x - xSize, y + xSize);
        ctx.stroke();
        break;
      }
      case 'blindflange': {
        // Double circle
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'electrical': {
        // Triangle pointing up
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y + size * 0.7);
        ctx.lineTo(x - size, y + size * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'drain': {
        // Triangle pointing down
        ctx.beginPath();
        ctx.moveTo(x, y + size);
        ctx.lineTo(x + size, y - size * 0.7);
        ctx.lineTo(x - size, y - size * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'vent': {
        // Triangle pointing up
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y + size * 0.7);
        ctx.lineTo(x - size, y + size * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'lock': {
        // Square/Rectangle
        const s = size * 0.85;
        ctx.beginPath();
        ctx.rect(x - s, y - s, s * 2, s * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'instrument': {
        // Circle with inner ring
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'other':
      default: {
        // Simple circle
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }
    }
  }, []);

  // Draw a single point
  const drawPoint = useCallback((
    ctx: CanvasRenderingContext2D,
    point: IsolationPoint,
    isSelected: boolean,
    isHovered: boolean
  ) => {
    const { x, y, pointType, tagNumber, status } = point;
    const size = isSelected ? pointSize + 3 : isHovered ? pointSize + 1 : pointSize;

    // Determine colors
    const typeColor = ISOLATION_POINT_TYPE_COLORS[pointType] || '#6b7280';
    const statusColor = ISOLATION_POINT_STATUS_COLORS[status] || '#6b7280';

    // Draw outer status ring
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(x, y, size + 6, 0, Math.PI * 2);
    ctx.fill();

    // Draw shape based on type
    drawShape(ctx, x, y, pointType, size, typeColor);

    // Draw selection ring
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(x, y, size + 10, 0, Math.PI * 2);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Draw tag number on top of shape - scale font with size
    ctx.fillStyle = '#ffffff';
    const fontSize = Math.max(9, Math.min(13, pointSize * 0.5));
    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 3;
    ctx.fillText(tagNumber || '?', x, y);
    ctx.shadowBlur = 0;

    // Draw tag number label below
    ctx.fillStyle = '#1f2937';
    ctx.font = `bold ${Math.max(10, Math.min(14, pointSize * 0.55))}px Inter, sans-serif`;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText(tagNumber || '?', x, y + size + 16);
    ctx.shadowBlur = 0;
  }, [drawShape, pointSize]);

  // Main render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw all points
    points.forEach((point) => {
      const isSelected = point.id === selectedPointId;
      const isHovered = point.id === hoveredPointId;
      drawPoint(ctx, point, isSelected, isHovered);
    });

    // Draw cursor preview when tool is active
    if (activeTool && !isLocked) {
      // This would show a ghost preview - handled by CSS cursor for now
    }
  }, [width, height, points, selectedPointId, hoveredPointId, activeTool, isLocked, drawPoint]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('IsolationCanvas: Mouse down', { isLocked, activeTool });

    if (isLocked) {
      console.log('IsolationCanvas: Canvas is locked');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    const clickedPoint = getPointAtPosition(x, y);

    if (clickedPoint) {
      // Start dragging existing point
      console.log('IsolationCanvas: Clicked existing point', clickedPoint);
      setIsDragging(true);
      setDragPointId(clickedPoint.id);
      onPointClick(clickedPoint);
    } else if (activeTool) {
      // Create new point
      console.log('IsolationCanvas: Creating new point', { x, y, activeTool });
      onPointCreate(x, y, activeTool);
    } else {
      console.log('IsolationCanvas: No active tool selected');
    }
  }, [isLocked, zoom, getPointAtPosition, activeTool, onPointClick, onPointCreate]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    if (isDragging && dragPointId && !isLocked) {
      // Move point
      onPointMove(dragPointId, x, y);
    } else {
      // Check for hover
      const hoveredPoint = getPointAtPosition(x, y);
      setHoveredPointId(hoveredPoint?.id || null);
    }
  }, [isDragging, dragPointId, isLocked, zoom, getPointAtPosition, onPointMove]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragPointId(null);
  }, []);

  // Handle click (for selection without drag)
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    const clickedPoint = getPointAtPosition(x, y);
    if (clickedPoint) {
      onPointClick(clickedPoint);
    }
  }, [zoom, getPointAtPosition, onPointClick]);

  // Determine cursor style
  const getCursorStyle = () => {
    if (isLocked) return 'default';
    if (isDragging) return 'grabbing';
    if (hoveredPointId) return 'grab';
    if (activeTool) return 'crosshair';
    return 'default';
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="isolation-canvas"
      style={{ cursor: getCursorStyle() }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
    />
  );
}
