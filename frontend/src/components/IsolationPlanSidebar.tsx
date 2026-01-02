import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiChevronDown,
  FiChevronRight,
  FiPlusCircle,
  FiShield,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiLock,
  FiUnlock,
  FiEdit2,
  FiTrash2,
  FiPlay,
  FiSquare,
  FiX,
  FiTarget,
  FiCircle,
  FiZap,
  FiDroplet,
  FiWind,
  FiTool,
  FiActivity,
  FiStar,
  FiPrinter,
  FiMove,
  FiMinus,
  FiMaximize2
} from 'react-icons/fi';
import { isolationPlanApi, isolationPointApi } from '../api/client';
import type {
  IsolationPlan,
  IsolationPoint,
  IsolationPlanStatus,
  IsolationPointStatus,
  IsolationPointType
} from '../types';
import {
  ISOLATION_PLAN_STATUS_LABELS,
  ISOLATION_PLAN_STATUS_COLORS,
  ISOLATION_POINT_TYPE_LABELS,
  ISOLATION_POINT_TYPE_COLORS,
  ISOLATION_POINT_STATUS_LABELS,
  ISOLATION_POINT_STATUS_COLORS
} from '../types';

interface IsolationPlanSidebarProps {
  diagramId: string;
  isAdmin: boolean;
  initialPlanId?: string | null;
  onPointSelected?: (point: IsolationPoint | null) => void;
  onToolChange?: (tool: IsolationPointType | null) => void;
  onLockChange?: (isLocked: boolean) => void;
  onPointsChange?: (points: IsolationPoint[]) => void;
  onPointSizeChange?: (size: number) => void;
  onCaptureDiagram?: () => Promise<string | null>;
}

const ISOLATION_SIDEBAR_STORAGE_KEY = 'isolation-sidebar-state';

// Tool definitions with icons
const TOOLS: { type: IsolationPointType; icon: React.ReactNode; label: string; color: string }[] = [
  { type: 'work_point', icon: <FiTarget />, label: 'Arbejdspunkt', color: '#ef4444' },
  { type: 'valve', icon: <FiCircle />, label: 'Ventil', color: '#3b82f6' },
  { type: 'blindflange', icon: <FiX />, label: 'Blindflange/Spade', color: '#f59e0b' },
  { type: 'electrical', icon: <FiZap />, label: 'Elektrisk', color: '#8b5cf6' },
  { type: 'drain', icon: <FiDroplet />, label: 'Afloeb', color: '#10b981' },
  { type: 'vent', icon: <FiWind />, label: 'Vent', color: '#06b6d4' },
  { type: 'lock', icon: <FiLock />, label: 'Laas', color: '#6366f1' },
  { type: 'instrument', icon: <FiActivity />, label: 'Instrument', color: '#ec4899' },
  { type: 'other', icon: <FiStar />, label: 'Andet', color: '#6b7280' },
];

export function IsolationPlanSidebar({
  diagramId,
  isAdmin,
  initialPlanId,
  onPointSelected,
  onToolChange,
  onLockChange,
  onPointsChange,
  onPointSizeChange,
  onCaptureDiagram,
}: IsolationPlanSidebarProps) {
  const [plans, setPlans] = useState<IsolationPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    tools: true,
    plans: true,
    points: true,
    details: true,
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPointModal, setShowPointModal] = useState(false);
  const [newPlan, setNewPlan] = useState({
    name: '',
    description: '',
    equipmentTag: '',
    workOrder: '',
    plannedStart: '',
    plannedEnd: '',
  });
  const [newPoint, setNewPoint] = useState({
    pointType: 'valve' as IsolationPointType,
    tagNumber: '',
    description: '',
    normalPosition: '',
    isolatedPosition: '',
    notes: '',
    x: 0,
    y: 0,
  });

  // Tool and lock state
  const [activeTool, setActiveTool] = useState<IsolationPointType | null>(null);
  const [isLocked, setIsLocked] = useState(true);

  // Draggable sidebar state - load from localStorage
  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      const saved = localStorage.getItem(ISOLATION_SIDEBAR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.isMinimized ?? false;
      }
    } catch { /* ignore */ }
    return false;
  });
  const [isHidden, setIsHidden] = useState(() => {
    try {
      const saved = localStorage.getItem(ISOLATION_SIDEBAR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.isHidden ?? false;
      }
    } catch { /* ignore */ }
    return false;
  });
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem(ISOLATION_SIDEBAR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.position ?? { x: 0, y: 0 };
      }
    } catch { /* ignore */ }
    return { x: 0, y: 0 };
  });
  const [size, setSize] = useState(() => {
    try {
      const saved = localStorage.getItem(ISOLATION_SIDEBAR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.size ?? { width: 380, height: 600 };
      }
    } catch { /* ignore */ }
    return { width: 380, height: 600 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Save state to localStorage
  useEffect(() => {
    const state = { position, size, isMinimized, isHidden };
    localStorage.setItem(ISOLATION_SIDEBAR_STORAGE_KEY, JSON.stringify(state));
  }, [position, size, isMinimized, isHidden]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
  }, [position]);

  // Handle drag move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;

      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;

      setPosition({
        x: dragRef.current.startPosX + deltaX,
        y: dragRef.current.startPosY + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Reset position
  const resetPosition = useCallback(() => {
    setPosition({ x: 0, y: 0 });
    setSize({ width: 380, height: 600 });
  }, []);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: size.width,
      startHeight: size.height,
    };
  }, [size]);

  // Handle resize move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return;

      const deltaX = e.clientX - resizeRef.current.startX;
      const deltaY = e.clientY - resizeRef.current.startY;

      setSize({
        width: Math.max(300, Math.min(600, resizeRef.current.startWidth - deltaX)),
        height: Math.max(300, Math.min(900, resizeRef.current.startHeight + deltaY)),
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to minimize
      if (e.key === 'Escape' && !isHidden) {
        setIsMinimized(true);
      }
      // Ctrl+Shift+S to toggle sidebar
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        setIsHidden((prev: boolean) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isHidden]);

  // Double-click header to snap to right
  const handleHeaderDoubleClick = useCallback(() => {
    setPosition({ x: 0, y: 0 });
    setSize({ width: 380, height: 600 });
  }, []);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const selectedPoint = selectedPlan?.points?.find(p => p.id === selectedPointId);

  // Notify parent of tool changes
  useEffect(() => {
    onToolChange?.(activeTool);
  }, [activeTool, onToolChange]);

  // Notify parent of lock changes
  useEffect(() => {
    onLockChange?.(isLocked);
  }, [isLocked, onLockChange]);

  // Notify parent of points changes
  useEffect(() => {
    onPointsChange?.(selectedPlan?.points || []);
  }, [selectedPlan?.points, onPointsChange]);

  useEffect(() => {
    loadPlans();
  }, [diagramId]);

  useEffect(() => {
    if (onPointSelected) {
      onPointSelected(selectedPoint || null);
    }
  }, [selectedPointId, selectedPoint, onPointSelected]);

  const loadPlans = async () => {
    setLoading(true);
    const { data, error } = await isolationPlanApi.getByDiagram(diagramId);
    if (!error && data) {
      setPlans(data);
      // Select initial plan if provided, otherwise first plan
      if (data.length > 0 && !selectedPlanId) {
        const planToSelect = initialPlanId && data.some(p => p.id === initialPlanId)
          ? initialPlanId
          : data[0].id;
        setSelectedPlanId(planToSelect);
        loadPlanDetails(planToSelect);
      }
    }
    setLoading(false);
  };

  const loadPlanDetails = async (planId: string) => {
    const { data, error } = await isolationPlanApi.getOne(planId);
    if (!error && data) {
      setPlans(prev => prev.map(p => p.id === planId ? data : p));
    }
  };

  const handleSelectPlan = async (planId: string) => {
    setSelectedPlanId(planId);
    setSelectedPointId(null);
    const plan = plans.find(p => p.id === planId);
    if (!plan?.points) {
      await loadPlanDetails(planId);
    }
  };

  const handleSelectPoint = (pointId: string) => {
    setSelectedPointId(pointId);
  };

  const handleToolSelect = (tool: IsolationPointType) => {
    if (isLocked) return;
    setActiveTool(activeTool === tool ? null : tool);
  };

  const handleToggleLock = () => {
    const newLocked = !isLocked;
    setIsLocked(newLocked);
    if (newLocked) {
      setActiveTool(null);
    }
  };

  const handlePointSizeChange = async (size: number) => {
    if (!selectedPlanId || isLocked) return;

    // Update locally first for immediate feedback
    setPlans(plans.map(p => p.id === selectedPlanId ? { ...p, pointSize: size } : p));

    // Notify parent component
    onPointSizeChange?.(size);

    // Update in backend
    const { error } = await isolationPlanApi.update(selectedPlanId, { pointSize: size });
    if (error) {
      console.error('Failed to update point size:', error);
      // Reload plan to revert on error
      await loadPlanDetails(selectedPlanId);
    }
  };

  // Called from DiagramPage when user clicks on canvas
  const handlePointCreate = async (x: number, y: number, type: IsolationPointType) => {
    if (!selectedPlanId) {
      alert('Vælg eller opret en sikringsplan først');
      return;
    }

    if (isLocked) {
      alert('Lås op for redigering ved at klikke på låse-ikonet');
      return;
    }

    // Show modal to collect point details
    setNewPoint({
      ...newPoint,
      pointType: type,
      x,
      y,
      tagNumber: '',
      description: '',
    });
    setShowPointModal(true);
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await isolationPlanApi.create(diagramId, newPlan);
    if (!error && data) {
      setPlans(prev => [...prev, data]);
      setSelectedPlanId(data.id);
      setShowCreateModal(false);
      setNewPlan({
        name: '',
        description: '',
        equipmentTag: '',
        workOrder: '',
        plannedStart: '',
        plannedEnd: '',
      });
      // Unlock for editing
      setIsLocked(false);
    }
  };

  const handleCreatePoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;

    const sequenceNumber = (selectedPlan?.points?.length || 0) + 1;

    const { data, error } = await isolationPointApi.create(selectedPlanId, {
      pointType: newPoint.pointType,
      tagNumber: newPoint.tagNumber || `P-${sequenceNumber}`,
      sequenceNumber,
      x: newPoint.x,
      y: newPoint.y,
      description: newPoint.description || undefined,
      normalPosition: newPoint.normalPosition || undefined,
      isolatedPosition: newPoint.isolatedPosition || undefined,
      notes: newPoint.notes || undefined,
    });

    if (!error && data) {
      await loadPlanDetails(selectedPlanId);
      setShowPointModal(false);
      setNewPoint({
        pointType: 'valve',
        tagNumber: '',
        description: '',
        normalPosition: '',
        isolatedPosition: '',
        notes: '',
        x: 0,
        y: 0,
      });
    }
  };

  const handleDeletePlan = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    const isActivePlan = plan?.status === 'active' || plan?.status === 'approved';

    const confirmMessage = isActivePlan
      ? 'ADVARSEL: Denne sikringsplan er aktiv/godkendt!\n\nEr du HELT sikker paa at du vil slette den?\nDette kan IKKE fortrydes!'
      : 'Er du sikker paa at du vil slette denne sikringsplan?';

    if (!confirm(confirmMessage)) return;

    const { error } = await isolationPlanApi.delete(planId);
    if (!error) {
      setPlans(prev => prev.filter(p => p.id !== planId));
      if (selectedPlanId === planId) {
        setSelectedPlanId(plans.length > 1 ? plans[0].id : null);
        setSelectedPointId(null);
      }
    }
  };

  const handleApprovePlan = async (planId: string) => {
    const { data, error } = await isolationPlanApi.approve(planId);
    if (!error && data) {
      setPlans(prev => prev.map(p => p.id === planId ? data : p));
    }
  };

  const handleActivatePlan = async (planId: string) => {
    const { data, error } = await isolationPlanApi.update(planId, {
      status: 'active',
      actualStart: new Date().toISOString().split('T')[0]
    });
    if (!error && data) {
      await loadPlanDetails(planId);
      setIsLocked(true); // Lock when active
    }
  };

  const handleCompletePlan = async (planId: string) => {
    const { data, error } = await isolationPlanApi.update(planId, {
      status: 'completed',
      actualEnd: new Date().toISOString().split('T')[0]
    });
    if (!error && data) {
      await loadPlanDetails(planId);
    }
  };

  const handlePrintPlan = async () => {
    if (!selectedPlan) return;

    const points = selectedPlan.points || [];
    const sortedPoints = [...points].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    // Capture diagram screenshot if available
    let diagramImageData: string | null = null;
    if (onCaptureDiagram) {
      try {
        diagramImageData = await onCaptureDiagram();
      } catch (err) {
        console.error('Failed to capture diagram:', err);
      }
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Kunne ikke aabne print-vindue. Tillad pop-ups for denne side.');
      return;
    }

    const formatDate = (dateStr?: string) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString('da-DK');
    };

    const formatDateTime = (dateStr?: string) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleString('da-DK');
    };

    const getPointTypeLabel = (type: IsolationPointType) => {
      return ISOLATION_POINT_TYPE_LABELS[type] || type;
    };

    const getStatusLabel = (status: IsolationPointStatus) => {
      return ISOLATION_POINT_STATUS_LABELS[status] || status;
    };

    // Generate legend HTML for all isolation point types
    const legendHtml = TOOLS.map(tool => `
      <div class="legend-item">
        <span class="legend-color" style="background: ${tool.color};"></span>
        <span class="legend-label">${tool.label}</span>
      </div>
    `).join('');

    const html = `
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <title>Sikringsplan - ${selectedPlan.name}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      margin: 0;
      padding: 20px;
      color: #000;
    }
    .header {
      border-bottom: 3px solid #1e40af;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0 0 5px 0;
      font-size: 24pt;
      color: #1e40af;
    }
    .header .subtitle {
      font-size: 14pt;
      color: #6b7280;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: bold;
      color: white;
      background: ${ISOLATION_PLAN_STATUS_COLORS[selectedPlan.status]};
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 30px;
      margin-bottom: 25px;
      padding: 15px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-size: 9pt;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .info-value {
      font-weight: 500;
    }
    .section-title {
      font-size: 14pt;
      color: #1e40af;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 8px;
      margin: 25px 0 15px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background: #1e40af;
      color: white;
      font-weight: 600;
      font-size: 10pt;
    }
    tr:nth-child(even) {
      background: #f9fafb;
    }
    .seq-num {
      font-weight: bold;
      text-align: center;
      width: 40px;
    }
    .status-cell {
      text-align: center;
      font-weight: 500;
    }
    .status-pending { color: #6b7280; }
    .status-isolated { color: #f59e0b; }
    .status-verified { color: #22c55e; }
    .status-restored { color: #3b82f6; }
    .signature-section {
      margin-top: 40px;
      page-break-inside: avoid;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }
    .signature-box {
      border: 1px solid #d1d5db;
      padding: 15px;
      min-height: 100px;
    }
    .signature-label {
      font-size: 9pt;
      color: #6b7280;
      margin-bottom: 50px;
    }
    .signature-line {
      border-top: 1px solid #000;
      padding-top: 5px;
      font-size: 10pt;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
      font-size: 9pt;
      color: #6b7280;
      text-align: center;
    }
    .point-history {
      font-size: 9pt;
      color: #6b7280;
    }
    .diagram-section {
      margin: 25px 0;
      page-break-inside: avoid;
    }
    .diagram-image {
      max-width: 100%;
      border: 1px solid #d1d5db;
      border-radius: 8px;
    }
    .legend-section {
      margin: 20px 0;
      padding: 15px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .legend-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend-color {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      border: 2px solid rgba(0,0,0,0.2);
    }
    .legend-label {
      font-size: 10pt;
    }
    @media print {
      body { padding: 10mm; }
      .no-print { display: none; }
      .diagram-section { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>SIKRINGSPLAN - LOTO</h1>
    <div class="subtitle">${selectedPlan.name}</div>
    <div style="margin-top: 10px;">
      <span class="status-badge">${ISOLATION_PLAN_STATUS_LABELS[selectedPlan.status]}</span>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-item">
      <span class="info-label">Equipment Tag</span>
      <span class="info-value">${selectedPlan.equipmentTag || '-'}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Work Order</span>
      <span class="info-value">${selectedPlan.workOrder || '-'}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Planlagt Start</span>
      <span class="info-value">${formatDate(selectedPlan.plannedStart)}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Planlagt Slut</span>
      <span class="info-value">${formatDate(selectedPlan.plannedEnd)}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Faktisk Start</span>
      <span class="info-value">${formatDate(selectedPlan.actualStart)}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Faktisk Slut</span>
      <span class="info-value">${formatDate(selectedPlan.actualEnd)}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Oprettet Af</span>
      <span class="info-value">${selectedPlan.createdByName || '-'}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Godkendt Af</span>
      <span class="info-value">${selectedPlan.approvedByName || '-'}</span>
    </div>
  </div>

  ${selectedPlan.description ? `
  <div class="info-item" style="margin-bottom: 20px;">
    <span class="info-label">Beskrivelse</span>
    <span class="info-value">${selectedPlan.description}</span>
  </div>
  ` : ''}

  <!-- Legend Section -->
  <div class="legend-section">
    <h3 style="margin: 0 0 10px 0; font-size: 12pt; color: #1e40af;">Signaturforklaring - Isoleringstyper</h3>
    <div class="legend-grid">
      ${legendHtml}
    </div>
  </div>

  <!-- Diagram Section -->
  ${diagramImageData ? `
  <div class="diagram-section">
    <h2 class="section-title">Tegning med isoleringspunkter</h2>
    <img src="${diagramImageData}" alt="Diagram" class="diagram-image" />
  </div>
  ` : ''}

  <h2 class="section-title">Isoleringspunkter (${points.length})</h2>

  ${points.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th class="seq-num">Nr.</th>
        <th>Tag</th>
        <th>Type</th>
        <th>Beskrivelse</th>
        <th>Normal Position</th>
        <th>Isoleret Position</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${sortedPoints.map(point => `
        <tr>
          <td class="seq-num">${point.sequenceNumber}</td>
          <td><strong>${point.tagNumber}</strong></td>
          <td>${getPointTypeLabel(point.pointType)}</td>
          <td>${point.description || '-'}</td>
          <td>${point.normalPosition || '-'}</td>
          <td>${point.isolatedPosition || '-'}</td>
          <td class="status-cell status-${point.status}">${getStatusLabel(point.status)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<p>Ingen isoleringspunkter defineret.</p>'}

  ${selectedPlan.status === 'active' || selectedPlan.status === 'completed' ? `
  <h2 class="section-title">Isoleringshistorik</h2>
  <table>
    <thead>
      <tr>
        <th class="seq-num">Nr.</th>
        <th>Tag</th>
        <th>Isoleret Af</th>
        <th>Isoleret Tid</th>
        <th>Verificeret Af</th>
        <th>Verificeret Tid</th>
        <th>Genetableret Af</th>
        <th>Genetableret Tid</th>
      </tr>
    </thead>
    <tbody>
      ${sortedPoints.map(point => `
        <tr>
          <td class="seq-num">${point.sequenceNumber}</td>
          <td><strong>${point.tagNumber}</strong></td>
          <td>${point.isolatedByName || '-'}</td>
          <td>${formatDateTime(point.isolatedAt)}</td>
          <td>${point.verifiedByName || '-'}</td>
          <td>${formatDateTime(point.verifiedAt)}</td>
          <td>${point.restoredByName || '-'}</td>
          <td>${formatDateTime(point.restoredAt)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <div class="signature-section">
    <h2 class="section-title">Underskrifter</h2>
    <div class="signature-grid">
      <div class="signature-box">
        <div class="signature-label">Ansvarlig for isolering</div>
        <div class="signature-line">Navn / Dato</div>
      </div>
      <div class="signature-box">
        <div class="signature-label">Verificeret af</div>
        <div class="signature-line">Navn / Dato</div>
      </div>
      <div class="signature-box">
        <div class="signature-label">Genetablering godkendt af</div>
        <div class="signature-line">Navn / Dato</div>
      </div>
      <div class="signature-box">
        <div class="signature-label">Arbejdsleder</div>
        <div class="signature-line">Navn / Dato</div>
      </div>
    </div>
  </div>

  <div class="footer">
    Udskrevet: ${new Date().toLocaleString('da-DK')} | AnlaegsPortalen - LOTO System
  </div>

  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleSendToApproval = async (planId: string) => {
    const { error } = await isolationPlanApi.update(planId, { status: 'pending_approval' });
    if (!error) {
      await loadPlanDetails(planId);
      setIsLocked(true);
    }
  };

  const handleIsolatePoint = async (pointId: string) => {
    const { error } = await isolationPointApi.isolate(pointId);
    if (!error && selectedPlanId) {
      await loadPlanDetails(selectedPlanId);
    }
  };

  const handleVerifyPoint = async (pointId: string) => {
    const { error } = await isolationPointApi.verify(pointId);
    if (!error && selectedPlanId) {
      await loadPlanDetails(selectedPlanId);
    }
  };

  const handleRestorePoint = async (pointId: string) => {
    const { error } = await isolationPointApi.restore(pointId);
    if (!error && selectedPlanId) {
      await loadPlanDetails(selectedPlanId);
    }
  };

  const handleDeletePoint = async (pointId: string) => {
    if (!confirm('Er du sikker paa at du vil slette dette isoleringspunkt?')) return;

    const { error } = await isolationPointApi.delete(pointId);
    if (!error && selectedPlanId) {
      await loadPlanDetails(selectedPlanId);
      if (selectedPointId === pointId) {
        setSelectedPointId(null);
      }
    }
  };

  const handlePointMove = async (pointId: string, x: number, y: number) => {
    if (isLocked) return;

    const { error } = await isolationPointApi.update(pointId, { x, y });
    if (!error && selectedPlanId) {
      // Update locally for immediate feedback
      setPlans(prev => prev.map(p => {
        if (p.id === selectedPlanId && p.points) {
          return {
            ...p,
            points: p.points.map(pt => pt.id === pointId ? { ...pt, x, y } : pt)
          };
        }
        return p;
      }));
    }
  };

  const toggleSection = (section: 'tools' | 'plans' | 'points' | 'details') => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getStatusIcon = (status: IsolationPlanStatus) => {
    switch (status) {
      case 'draft': return <FiEdit2 />;
      case 'pending_approval': return <FiClock />;
      case 'approved': return <FiCheck />;
      case 'active': return <FiPlay />;
      case 'completed': return <FiCheckCircle />;
      case 'cancelled': return <FiSquare />;
      default: return <FiShield />;
    }
  };

  const getPointStatusIcon = (status: IsolationPointStatus) => {
    switch (status) {
      case 'pending': return <FiClock />;
      case 'isolated': return <FiLock />;
      case 'verified': return <FiCheckCircle />;
      case 'restored': return <FiUnlock />;
      default: return <FiShield />;
    }
  };

  // Can edit if admin and plan is draft
  const canEdit = isAdmin && selectedPlan?.status === 'draft';

  // Debug logging
  useEffect(() => {
    console.log('IsolationPlanSidebar state:', {
      isAdmin,
      selectedPlanId,
      selectedPlanStatus: selectedPlan?.status,
      canEdit,
      isLocked,
      activeTool,
    });
  }, [isAdmin, selectedPlanId, selectedPlan?.status, canEdit, isLocked, activeTool]);

  // Expose functions for parent component
  (window as any).__isolationSidebar = {
    handlePointCreate,
    handlePointMove,
  };

  // Show toggle button when hidden
  if (isHidden) {
    return (
      <button
        className="sidebar-show-btn isolation-show-btn"
        onClick={() => setIsHidden(false)}
        title="Vis sikringsplan (Ctrl+Shift+S)"
      >
        <FiShield />
        <span>Sikringsplan</span>
      </button>
    );
  }

  return (
    <aside
      ref={sidebarRef}
      className={`sidebar sidebar-floating isolation-sidebar ${isMinimized ? 'minimized' : ''} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: isMinimized ? 'auto' : `${size.width}px`,
        height: isMinimized ? 'auto' : `${size.height}px`,
      }}
    >
      <div
        className="sidebar-drag-header"
        onMouseDown={handleDragStart}
        onDoubleClick={handleHeaderDoubleClick}
      >
        <div className="drag-handle">
          <FiMove />
          <h2>
            <FiShield style={{ marginRight: '0.5rem' }} />
            Sikringsplan
          </h2>
        </div>
        <div className="sidebar-controls">
          {selectedPlan && (
            <button
              className={`lock-toggle ${isLocked ? 'locked' : 'unlocked'}`}
              onClick={handleToggleLock}
              disabled={!canEdit}
              title={isLocked ? 'Laas op for redigering' : 'Laas tegning'}
            >
              {isLocked ? <FiLock /> : <FiUnlock />}
            </button>
          )}
          {(position.x !== 0 || position.y !== 0 || size.width !== 380 || size.height !== 600) && (
            <button className="btn-reset" onClick={resetPosition} title="Nulstil position og størrelse">
              ↺
            </button>
          )}
          <button
            className="btn-minimize"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Udvid' : 'Minimer'}
          >
            {isMinimized ? <FiMaximize2 /> : <FiMinus />}
          </button>
          <button
            className="btn-close"
            onClick={() => setIsHidden(true)}
            title="Skjul (Ctrl+Shift+S for at vise igen)"
          >
            <FiX />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="sidebar-content">
            {/* Tools Section */}
            {selectedPlan && canEdit && (
              <div className="sidebar-section tools-section">
                <button className="section-header" onClick={() => toggleSection('tools')}>
                  {expandedSections.tools ? <FiChevronDown /> : <FiChevronRight />}
                  <FiTool style={{ marginLeft: '0.25rem' }} />
                  <span>Vaerktojer</span>
                </button>

                {expandedSections.tools && (
                  <div className="tools-grid">
                    {TOOLS.map((tool) => (
                      <button
                        key={tool.type}
                        className={`tool-button ${activeTool === tool.type ? 'active' : ''} ${isLocked ? 'disabled' : ''}`}
                        onClick={() => handleToolSelect(tool.type)}
                        disabled={isLocked}
                        title={tool.label}
                        style={{
                          '--tool-color': tool.color,
                        } as React.CSSProperties}
                      >
                        {tool.icon}
                        <span className="tool-label">{tool.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {!isLocked && activeTool && (
                  <div className="tool-hint">
                    Klik paa tegningen for at placere {ISOLATION_POINT_TYPE_LABELS[activeTool].toLowerCase()}
                  </div>
                )}

                {/* Point Size Slider */}
                {selectedPlan && (
                  <div className="point-size-control" style={{ marginTop: '1rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                      <span>Punktstørrelse</span>
                      <span style={{ color: '#6b7280' }}>{selectedPlan.pointSize || 22}px</span>
                    </label>
                    <input
                      type="range"
                      min="12"
                      max="40"
                      value={selectedPlan.pointSize || 22}
                      onChange={(e) => handlePointSizeChange(parseInt(e.target.value))}
                      disabled={isLocked}
                      style={{ width: '100%' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                      <span>Lille (12)</span>
                      <span>Stor (40)</span>
                    </div>
                  </div>
                )}
              </div>
            )}

      {/* Plans List */}
      <div className="sidebar-section">
        <button className="section-header" onClick={() => toggleSection('plans')}>
          {expandedSections.plans ? <FiChevronDown /> : <FiChevronRight />}
          <span>Planer ({plans.length})</span>
        </button>

        {expandedSections.plans && (
          <div className="isolation-plans-list">
            {loading ? (
              <div className="loading-state" style={{ padding: '1rem' }}>
                <small>Indlaeser planer...</small>
              </div>
            ) : plans.length === 0 ? (
              <div className="empty-state" style={{ padding: '1rem' }}>
                <FiShield style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.5 }} />
                <p>Ingen sikringsplaner endnu</p>
              </div>
            ) : (
              plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`isolation-plan-item ${plan.id === selectedPlanId ? 'selected' : ''}`}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  <span
                    className="plan-status-icon"
                    style={{ color: ISOLATION_PLAN_STATUS_COLORS[plan.status] }}
                  >
                    {getStatusIcon(plan.status)}
                  </span>
                  <div className="plan-info">
                    <span className="plan-name">{plan.name}</span>
                    <span className="plan-status" style={{ color: ISOLATION_PLAN_STATUS_COLORS[plan.status] }}>
                      {ISOLATION_PLAN_STATUS_LABELS[plan.status]}
                    </span>
                  </div>
                  {plan.pointCount !== undefined && (
                    <span className="plan-point-count">
                      {plan.verifiedCount || 0}/{plan.pointCount}
                    </span>
                  )}
                </div>
              ))
            )}

            {isAdmin && (
              <button className="btn-new-plan" onClick={() => setShowCreateModal(true)}>
                <FiPlusCircle />
                Ny sikringsplan
              </button>
            )}
          </div>
        )}
      </div>

      {/* Selected Plan Details */}
      {selectedPlan && (
        <>
          {/* Plan Actions */}
          <div className="plan-actions-bar">
            <span
              className="plan-status-badge"
              style={{
                background: ISOLATION_PLAN_STATUS_COLORS[selectedPlan.status],
                color: 'white'
              }}
            >
              {ISOLATION_PLAN_STATUS_LABELS[selectedPlan.status]}
            </span>

            <div className="plan-action-buttons">
              {isAdmin && selectedPlan.status === 'draft' && (
                <button
                  className="btn-icon-small"
                  onClick={() => handleSendToApproval(selectedPlan.id)}
                  title="Send til godkendelse"
                >
                  <FiClock />
                </button>
              )}

              {isAdmin && selectedPlan.status === 'pending_approval' && (
                <button
                  className="btn-icon-small success"
                  onClick={() => handleApprovePlan(selectedPlan.id)}
                  title="Godkend"
                >
                  <FiCheck />
                </button>
              )}

              {selectedPlan.status === 'approved' && (
                <button
                  className="btn-icon-small success"
                  onClick={() => handleActivatePlan(selectedPlan.id)}
                  title="Aktiver plan"
                >
                  <FiPlay />
                </button>
              )}

              {selectedPlan.status === 'active' && (
                <button
                  className="btn-icon-small"
                  onClick={() => handleCompletePlan(selectedPlan.id)}
                  title="Afslut plan"
                >
                  <FiCheckCircle />
                </button>
              )}

              {/* Print button - always visible when plan is selected */}
              <button
                className="btn-icon-small"
                onClick={handlePrintPlan}
                title="Udskriv sikringsplan"
              >
                <FiPrinter />
              </button>

              {isAdmin && (
                <button
                  className="btn-icon-small danger"
                  onClick={() => handleDeletePlan(selectedPlan.id)}
                  title="Slet plan"
                >
                  <FiTrash2 />
                </button>
              )}
            </div>
          </div>

          {/* Isolation Points */}
          <div className="sidebar-section">
            <button className="section-header" onClick={() => toggleSection('points')}>
              {expandedSections.points ? <FiChevronDown /> : <FiChevronRight />}
              <FiLock style={{ marginLeft: '0.25rem' }} />
              <span>Isoleringspunkter ({selectedPlan.points?.length || 0})</span>
            </button>

            {expandedSections.points && (
              <div className="isolation-points-list">
                {!selectedPlan.points || selectedPlan.points.length === 0 ? (
                  <div className="empty-state" style={{ padding: '1rem', background: 'transparent', border: 'none' }}>
                    <small>
                      {canEdit && !isLocked
                        ? 'Vaelg et vaerktoj og klik paa tegningen'
                        : 'Ingen isoleringspunkter'}
                    </small>
                  </div>
                ) : (
                  selectedPlan.points
                    .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
                    .map((point) => (
                      <div
                        key={point.id}
                        className={`isolation-point-item ${point.id === selectedPointId ? 'selected' : ''}`}
                        onClick={() => handleSelectPoint(point.id)}
                      >
                        <span
                          className="point-sequence"
                          style={{ background: ISOLATION_POINT_TYPE_COLORS[point.pointType] }}
                        >
                          {point.sequenceNumber}
                        </span>
                        <div className="point-info">
                          <span className="point-tag">{point.tagNumber}</span>
                          <span className="point-type">{ISOLATION_POINT_TYPE_LABELS[point.pointType]}</span>
                        </div>
                        <span
                          className="point-status-indicator"
                          style={{ background: ISOLATION_POINT_STATUS_COLORS[point.status] }}
                          title={ISOLATION_POINT_STATUS_LABELS[point.status]}
                        >
                          {getPointStatusIcon(point.status)}
                        </span>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>

          {/* Selected Point Details */}
          {selectedPoint && (
            <div className="sidebar-section">
              <button className="section-header" onClick={() => toggleSection('details')}>
                {expandedSections.details ? <FiChevronDown /> : <FiChevronRight />}
                <span>Punkt detaljer</span>
              </button>

              {expandedSections.details && (
                <div className="isolation-point-details">
                  <div className="point-detail-header">
                    <span
                      className="point-type-badge"
                      style={{
                        background: ISOLATION_POINT_TYPE_COLORS[selectedPoint.pointType],
                        color: 'white'
                      }}
                    >
                      {ISOLATION_POINT_TYPE_LABELS[selectedPoint.pointType]}
                    </span>
                    <span
                      className="point-status-badge"
                      style={{
                        background: ISOLATION_POINT_STATUS_COLORS[selectedPoint.status],
                        color: 'white'
                      }}
                    >
                      {ISOLATION_POINT_STATUS_LABELS[selectedPoint.status]}
                    </span>
                  </div>

                  <div className="point-detail-row">
                    <label>Tag nummer</label>
                    <span>{selectedPoint.tagNumber}</span>
                  </div>

                  {selectedPoint.description && (
                    <div className="point-detail-row">
                      <label>Beskrivelse</label>
                      <span>{selectedPoint.description}</span>
                    </div>
                  )}

                  {selectedPoint.normalPosition && (
                    <div className="point-detail-row">
                      <label>Normal position</label>
                      <span>{selectedPoint.normalPosition}</span>
                    </div>
                  )}

                  {selectedPoint.isolatedPosition && (
                    <div className="point-detail-row">
                      <label>Isoleret position</label>
                      <span>{selectedPoint.isolatedPosition}</span>
                    </div>
                  )}

                  {selectedPoint.notes && (
                    <div className="point-detail-row">
                      <label>Noter</label>
                      <span>{selectedPoint.notes}</span>
                    </div>
                  )}

                  {/* Action buttons based on status */}
                  {selectedPlan.status === 'active' && (
                    <div className="point-action-buttons">
                      {selectedPoint.status === 'pending' && (
                        <button
                          className="btn-point-action isolate"
                          onClick={() => handleIsolatePoint(selectedPoint.id)}
                        >
                          <FiLock />
                          Marker som isoleret
                        </button>
                      )}

                      {selectedPoint.status === 'isolated' && (
                        <button
                          className="btn-point-action verify"
                          onClick={() => handleVerifyPoint(selectedPoint.id)}
                        >
                          <FiCheckCircle />
                          Verificer isolering
                        </button>
                      )}

                      {selectedPoint.status === 'verified' && (
                        <button
                          className="btn-point-action restore"
                          onClick={() => handleRestorePoint(selectedPoint.id)}
                        >
                          <FiUnlock />
                          Genetabler
                        </button>
                      )}
                    </div>
                  )}

                  {/* History */}
                  {(selectedPoint.isolatedAt || selectedPoint.verifiedAt || selectedPoint.restoredAt) && (
                    <div className="point-history">
                      <label>Historik</label>
                      {selectedPoint.isolatedAt && (
                        <div className="history-entry">
                          <FiLock />
                          <span>Isoleret: {new Date(selectedPoint.isolatedAt).toLocaleString('da-DK')}</span>
                          {selectedPoint.isolatedByName && <small>af {selectedPoint.isolatedByName}</small>}
                        </div>
                      )}
                      {selectedPoint.verifiedAt && (
                        <div className="history-entry">
                          <FiCheckCircle />
                          <span>Verificeret: {new Date(selectedPoint.verifiedAt).toLocaleString('da-DK')}</span>
                          {selectedPoint.verifiedByName && <small>af {selectedPoint.verifiedByName}</small>}
                        </div>
                      )}
                      {selectedPoint.restoredAt && (
                        <div className="history-entry">
                          <FiUnlock />
                          <span>Genetableret: {new Date(selectedPoint.restoredAt).toLocaleString('da-DK')}</span>
                          {selectedPoint.restoredByName && <small>af {selectedPoint.restoredByName}</small>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Delete button */}
                  {canEdit && !isLocked && (
                    <button
                      className="btn-delete-point"
                      onClick={() => handleDeletePoint(selectedPoint.id)}
                    >
                      <FiTrash2 />
                      Slet punkt
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

          {/* Create Plan Modal */}
          {showCreateModal && (
            <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
              <div className="modal isolation-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                  <FiShield />
                  Opret sikringsplan
                </h2>
                <form onSubmit={handleCreatePlan}>
                  <div className="form-group">
                    <label>Navn *</label>
                    <input
                      type="text"
                      value={newPlan.name}
                      onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                      placeholder="F.eks. Tank T-101 inspektion"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label>Beskrivelse</label>
                    <textarea
                      value={newPlan.description}
                      onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                      placeholder="Beskrivelse af arbejdet..."
                      rows={3}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Udstyrs-tag</label>
                      <input
                        type="text"
                        value={newPlan.equipmentTag}
                        onChange={(e) => setNewPlan({ ...newPlan, equipmentTag: e.target.value })}
                        placeholder="F.eks. T-101"
                      />
                    </div>

                    <div className="form-group">
                      <label>Arbejdsordre</label>
                      <input
                        type="text"
                        value={newPlan.workOrder}
                        onChange={(e) => setNewPlan({ ...newPlan, workOrder: e.target.value })}
                        placeholder="F.eks. WO-2024-001"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Planlagt start</label>
                      <input
                        type="date"
                        value={newPlan.plannedStart}
                        onChange={(e) => setNewPlan({ ...newPlan, plannedStart: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Planlagt slut</label>
                      <input
                        type="date"
                        value={newPlan.plannedEnd}
                        onChange={(e) => setNewPlan({ ...newPlan, plannedEnd: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                      Annuller
                    </button>
                    <button type="submit" className="btn-primary">
                      <FiShield />
                      Opret plan
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Create Point Modal */}
          {showPointModal && (
            <div className="modal-overlay" onClick={() => setShowPointModal(false)}>
              <div className="modal isolation-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                  <span style={{ color: ISOLATION_POINT_TYPE_COLORS[newPoint.pointType] }}>
                    {TOOLS.find(t => t.type === newPoint.pointType)?.icon}
                  </span>
                  Tilfoej {ISOLATION_POINT_TYPE_LABELS[newPoint.pointType]}
                </h2>
                <form onSubmit={handleCreatePoint}>
                  <div className="form-group">
                    <label>Tag nummer *</label>
                    <input
                      type="text"
                      value={newPoint.tagNumber}
                      onChange={(e) => setNewPoint({ ...newPoint, tagNumber: e.target.value })}
                      placeholder="F.eks. XV-101"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label>Beskrivelse</label>
                    <input
                      type="text"
                      value={newPoint.description}
                      onChange={(e) => setNewPoint({ ...newPoint, description: e.target.value })}
                      placeholder="F.eks. Afspaerringsventil til tank"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Normal position</label>
                      <input
                        type="text"
                        value={newPoint.normalPosition}
                        onChange={(e) => setNewPoint({ ...newPoint, normalPosition: e.target.value })}
                        placeholder="F.eks. Aaben"
                      />
                    </div>

                    <div className="form-group">
                      <label>Isoleret position</label>
                      <input
                        type="text"
                        value={newPoint.isolatedPosition}
                        onChange={(e) => setNewPoint({ ...newPoint, isolatedPosition: e.target.value })}
                        placeholder="F.eks. Lukket + laast"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Noter</label>
                    <textarea
                      value={newPoint.notes}
                      onChange={(e) => setNewPoint({ ...newPoint, notes: e.target.value })}
                      placeholder="Eventuelle noter..."
                      rows={2}
                    />
                  </div>

                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={() => setShowPointModal(false)}>
                      Annuller
                    </button>
                    <button type="submit" className="btn-primary">
                      <FiPlusCircle />
                      Tilfoej punkt
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          </div>

          {/* Resize Handle */}
          <div
            className="sidebar-resize-handle"
            onMouseDown={handleResizeStart}
            title="Træk for at ændre størrelse"
          />
        </>
      )}
    </aside>
  );
}
