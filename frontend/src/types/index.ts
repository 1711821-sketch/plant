// User type
export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'user';
}

// Terminal type
export interface Terminal {
  id: string;
  name: string;
  code: string;
  description?: string;
  locationCount?: number;
  diagramCount?: number;
  createdAt: string;
  updatedAt: string;
}

// Location type
export interface Location {
  id: string;
  terminalId: string;
  name: string;
  description?: string;
  diagramCount?: number;
  createdAt: string;
  updatedAt: string;
}

// Annotation type (pipe, tank, component)
export type AnnotationType = 'pipe' | 'tank' | 'component';

// Annotation type labels (Danish)
export const ANNOTATION_TYPE_LABELS: Record<AnnotationType, string> = {
  pipe: 'Rør',
  tank: 'Tank',
  component: 'Anlægskomponent',
};

// Annotation type KKS prefixes
export const ANNOTATION_TYPE_KKS_PREFIX: Record<AnnotationType, string> = {
  pipe: 'RØR',
  tank: 'TANK',
  component: 'KOMP',
};

// Annotation type colors
export const ANNOTATION_TYPE_COLORS: Record<AnnotationType, string> = {
  pipe: '#3b82f6',
  tank: '#8b5cf6',
  component: '#f59e0b',
};

// Rør/Tank/Komponent annotation type
export interface PipeAnnotation {
  id: string;
  annotationType: AnnotationType;
  kksNumber: string;
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
  description?: string;
  material?: string;
  diameter?: string;
  lastInspection?: string;
  nextInspection?: string;
  status: 'ok' | 'warning' | 'critical' | 'not_inspected';
  createdAt: string;
  updatedAt: string;
}

// Tegning/Diagram type
export interface Diagram {
  id: string;
  locationId?: string;
  name: string;
  pdfUrl: string;
  annotations: PipeAnnotation[];
  locationName?: string;
  terminalCode?: string;
  createdAt: string;
  updatedAt: string;
}

// Status farver
export const STATUS_COLORS = {
  ok: '#22c55e',
  warning: '#eab308',
  critical: '#ef4444',
  not_inspected: '#6b7280',
} as const;

// Inspection types
export type InspectionOverallStatus = 'approved' | 'conditional' | 'rejected' | 'pending';
export type ChecklistStatus = 'ok' | '1' | '2' | '3' | 'na';

export interface Inspection {
  id: string;
  annotationId: string;
  reportNumber?: string;
  inspectionDate: string;
  nextInspectionDate?: string;
  inspectorName: string;
  inspectorCert?: string;
  approverName?: string;
  approverCert?: string;
  overallStatus: InspectionOverallStatus;
  conclusion?: string;
  createdAt: string;
  updatedAt: string;
  // Related data
  kksNumber?: string;
  material?: string;
  diameter?: string;
  checklist?: InspectionChecklistItem[];
  tmlMeasurements?: TmlMeasurement[];
  images?: InspectionImage[];
  documents?: InspectionDocument[];
}

export interface InspectionChecklistItem {
  id: string;
  inspectionId: string;
  itemNumber: number;
  itemName: string;
  status: ChecklistStatus;
  comment?: string;
  reference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TmlMeasurement {
  id: string;
  inspectionId: string;
  tmlNumber: number;
  objectType?: string;
  activity?: string;
  dimension?: string;
  tNom?: number;
  tRet?: number;
  tAlert?: number;
  tMeasured?: number;
  position?: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionImage {
  id: string;
  inspectionId: string;
  filename: string;
  originalName: string;
  comment?: string;
  imageNumber?: number;
  createdAt: string;
}

export interface InspectionDocument {
  id: string;
  inspectionId: string;
  filename: string;
  originalName: string;
  documentType: string;
  description?: string;
  createdAt: string;
}

// Inspection status colors
export const INSPECTION_STATUS_COLORS = {
  approved: '#22c55e',
  conditional: '#eab308',
  rejected: '#ef4444',
  pending: '#6b7280',
} as const;

// Checklist status labels (Danish)
export const CHECKLIST_STATUS_LABELS = {
  ok: 'OK',
  '1': '1 - Mindre afvigelse',
  '2': '2 - Moderat afvigelse',
  '3': '3 - Alvorlig afvigelse',
  na: 'N/A',
} as const;

// ============ ISOLATION PLANS (SIKRINGSPLANER) ============

export type IsolationPlanStatus = 'draft' | 'pending_approval' | 'approved' | 'active' | 'completed' | 'cancelled';
export type IsolationPointType = 'work_point' | 'valve' | 'blindflange' | 'electrical' | 'drain' | 'vent' | 'lock' | 'instrument' | 'other';
export type IsolationPointStatus = 'pending' | 'isolated' | 'verified' | 'restored';

export const ISOLATION_PLAN_STATUS_LABELS: Record<IsolationPlanStatus, string> = {
  draft: 'Kladde',
  pending_approval: 'Afventer godkendelse',
  approved: 'Godkendt',
  active: 'Aktiv',
  completed: 'Afsluttet',
  cancelled: 'Annulleret',
};

export const ISOLATION_PLAN_STATUS_COLORS: Record<IsolationPlanStatus, string> = {
  draft: '#6b7280',
  pending_approval: '#f59e0b',
  approved: '#3b82f6',
  active: '#22c55e',
  completed: '#8b5cf6',
  cancelled: '#ef4444',
};

export const ISOLATION_POINT_TYPE_LABELS: Record<IsolationPointType, string> = {
  work_point: 'Arbejdspunkt',
  valve: 'Ventil',
  blindflange: 'Blindflange',
  electrical: 'Elektrisk afbryder',
  drain: 'Dræn',
  vent: 'Vent',
  lock: 'Lås (LOTO)',
  instrument: 'Instrument',
  other: 'Andet',
};

export const ISOLATION_POINT_TYPE_ICONS: Record<IsolationPointType, string> = {
  work_point: '🎯',
  valve: '⊗',
  blindflange: '◉',
  electrical: '⚡',
  drain: '▽',
  vent: '△',
  lock: '🔒',
  instrument: '◎',
  other: '●',
};

export const ISOLATION_POINT_TYPE_COLORS: Record<IsolationPointType, string> = {
  work_point: '#dc2626',
  valve: '#ef4444',
  blindflange: '#f97316',
  electrical: '#eab308',
  drain: '#22c55e',
  vent: '#14b8a6',
  lock: '#6366f1',
  instrument: '#8b5cf6',
  other: '#6b7280',
};

export const ISOLATION_POINT_STATUS_LABELS: Record<IsolationPointStatus, string> = {
  pending: 'Afventer',
  isolated: 'Isoleret',
  verified: 'Verificeret',
  restored: 'Genetableret',
};

export const ISOLATION_POINT_STATUS_COLORS: Record<IsolationPointStatus, string> = {
  pending: '#6b7280',
  isolated: '#f59e0b',
  verified: '#22c55e',
  restored: '#3b82f6',
};

export interface IsolationPlan {
  id: string;
  diagramId: string;
  name: string;
  description?: string;
  equipmentTag?: string;
  workOrder?: string;
  status: IsolationPlanStatus;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  pointSize?: number; // Size of isolation point markers (default 22)
  createdBy: string;
  createdByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Computed
  pointCount?: number;
  isolatedCount?: number;
  verifiedCount?: number;
  diagramName?: string;
  locationName?: string;
  terminalCode?: string;
  points?: IsolationPoint[];
}

export interface IsolationPoint {
  id: string;
  planId: string;
  pointType: IsolationPointType;
  tagNumber: string;
  description?: string;
  sequenceNumber: number;
  normalPosition?: string;
  isolatedPosition?: string;
  x: number;
  y: number;
  color: string;
  status: IsolationPointStatus;
  label?: string;
  isolatedBy?: string;
  isolatedByName?: string;
  isolatedAt?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  restoredBy?: string;
  restoredByName?: string;
  restoredAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
