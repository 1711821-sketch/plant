import type { User, Terminal, Location, Inspection, InspectionChecklistItem, TmlMeasurement, InspectionImage, InspectionDocument, IsolationPlan, IsolationPoint, IsolationPlanStatus, IsolationPointType } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Token storage
let authToken: string | null = localStorage.getItem('authToken');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
}

export function getAuthToken() {
  return authToken;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    // Add auth token if available
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error || `HTTP error: ${response.status}` };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Netværksfejl' };
  }
}

// Auth API
export const authApi = {
  login: async (username: string, password: string) => {
    const result = await request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (result.data?.token) {
      setAuthToken(result.data.token);
    }

    return result;
  },

  logout: async () => {
    await request('/api/auth/logout', { method: 'POST' });
    setAuthToken(null);
  },

  me: () => request<{ userId: string; role: string; name: string }>('/api/auth/me'),
};

// Terminal API
export const terminalApi = {
  getAll: () => request<(Terminal & { location_count: number; diagram_count: number })[]>('/api/terminals'),

  getOne: (id: string) => request<Terminal & { locations: Location[] }>(`/api/terminals/${id}`),

  create: (data: { name: string; code: string; description?: string }) =>
    request<Terminal>('/api/terminals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name: string; description?: string }) =>
    request<Terminal>(`/api/terminals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

// Location API
export const locationApi = {
  getByTerminal: (terminalId: string) =>
    request<(Location & { diagram_count: number })[]>(`/api/terminals/${terminalId}/locations`),

  getOne: (id: string) => request<{ id: string; terminal_id: string; name: string; description: string | null; terminal_name: string; terminal_code: string; created_at: string; updated_at: string; diagrams: any[] }>(`/api/locations/${id}`),

  create: (terminalId: string, data: { name: string; description?: string }) =>
    request<Location>(`/api/terminals/${terminalId}/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name: string; description?: string }) =>
    request<Location>(`/api/locations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/api/locations/${id}`, {
      method: 'DELETE',
    }),
};

// Diagram API
export const diagramApi = {
  getAll: (locationId?: string) => {
    const query = locationId ? `?locationId=${locationId}` : '';
    return request<any[]>(`/api/diagrams${query}`);
  },

  getOne: (id: string) => request<any>(`/api/diagrams/${id}`),

  create: async (file: File, name?: string, locationId?: string) => {
    const formData = new FormData();
    formData.append('pdf', file);
    if (name) formData.append('name', name);
    if (locationId) formData.append('locationId', locationId);

    return request<any>('/api/diagrams', {
      method: 'POST',
      body: formData,
    });
  },

  update: (id: string, data: { name?: string; locationId?: string }) =>
    request<any>(`/api/diagrams/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/api/diagrams/${id}`, {
      method: 'DELETE',
    }),
};

// Annotation API
export const annotationApi = {
  create: (diagramId: string, annotation: any) =>
    request<any>(`/api/diagrams/${diagramId}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annotation),
    }),

  update: (id: string, updates: any) =>
    request<any>(`/api/annotations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/api/annotations/${id}`, {
      method: 'DELETE',
    }),
};

// Dashboard stats types
export interface DashboardStats {
  overview: {
    total_terminals: number;
    total_locations: number;
    total_diagrams: number;
    total_annotations: number;
    total_inspections: number;
    upcoming_inspections: number;
    overdue_inspections: number;
    critical_measurements: number;
  };
  annotationStatus: {
    ok_count: number;
    warning_count: number;
    critical_count: number;
    not_inspected_count: number;
  };
  inspectionStatus: {
    approved_count: number;
    conditional_count: number;
    rejected_count: number;
    pending_count: number;
  };
  terminalStats: {
    id: string;
    code: string;
    name: string;
    annotation_count: number;
    ok_count: number;
    warning_count: number;
    critical_count: number;
    not_inspected_count: number;
  }[];
  recentInspections: {
    id: string;
    annotation_id: string;
    kks_number: string;
    terminal_code: string | null;
    inspection_date: string;
    overall_status: string;
    inspector_name: string;
    created_at: string;
  }[];
}

// Terminal-specific stats types
export interface TerminalStats {
  overview: {
    total_locations: number;
    total_diagrams: number;
    total_annotations: number;
    total_inspections: number;
    upcoming_count: number;
    overdue_count: number;
    critical_measurements: number;
  };
  annotationStatus: {
    ok_count: number;
    warning_count: number;
    critical_count: number;
    not_inspected_count: number;
  };
  annotationTypes: {
    pipe_count: number;
    tank_count: number;
    component_count: number;
  };
  upcomingInspections: {
    id: string;
    kks_number: string;
    next_inspection: string;
    status: string;
    material: string | null;
    diameter: string | null;
    diagram_id: string;
    diagram_name: string;
    location_name: string;
    days_until: number;
  }[];
  overdueInspections: {
    id: string;
    kks_number: string;
    next_inspection: string;
    status: string;
    material: string | null;
    diameter: string | null;
    diagram_id: string;
    diagram_name: string;
    location_name: string;
    days_overdue: number;
  }[];
  recentInspections: {
    id: string;
    annotation_id: string;
    kks_number: string;
    material: string | null;
    diagram_name: string;
    location_name: string;
    inspection_date: string;
    overall_status: string;
    inspector_name: string;
    created_at: string;
  }[];
  locationStats: {
    id: string;
    name: string;
    annotation_count: number;
    ok_count: number;
    warning_count: number;
    critical_count: number;
    not_inspected_count: number;
  }[];
  inspectionTimeline: {
    month: string;
    count: number;
  }[];
}

// Stats API
export const statsApi = {
  get: () => request<any>('/api/stats'),
  getDashboard: (annotationType?: string) => {
    const query = annotationType ? `?annotationType=${annotationType}` : '';
    return request<DashboardStats>(`/api/stats/dashboard${query}`);
  },
  getTerminal: (terminalId: string, annotationType?: string) => {
    const query = annotationType ? `?annotationType=${annotationType}` : '';
    return request<TerminalStats>(`/api/stats/terminal/${terminalId}${query}`);
  },
};

// Search types and API
export interface SearchResult {
  type: 'annotation' | 'terminal' | 'location' | 'diagram';
  id: string;
  title: string;
  subtitle: string;
  terminal_code?: string;
  status?: string;
  url: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
}

export const searchApi = {
  search: (query: string) => request<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`),
};

// Inspection API
export const inspectionApi = {
  // Get all inspections for an annotation
  getByAnnotation: (annotationId: string) =>
    request<Inspection[]>(`/api/annotations/${annotationId}/inspections`),

  // Get single inspection with all details
  getOne: (id: string) => request<Inspection>(`/api/inspections/${id}`),

  // Create new inspection
  create: (annotationId: string, data: {
    reportNumber?: string;
    inspectionDate: string;
    nextInspectionDate?: string;
    inspectorName: string;
    inspectorCert?: string;
    approverName?: string;
    approverCert?: string;
    overallStatus?: string;
    conclusion?: string;
  }) =>
    request<Inspection>(`/api/annotations/${annotationId}/inspections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Update inspection
  update: (id: string, data: Partial<{
    reportNumber: string;
    inspectionDate: string;
    nextInspectionDate: string | null;
    inspectorName: string;
    inspectorCert: string | null;
    approverName: string | null;
    approverCert: string | null;
    overallStatus: string;
    conclusion: string | null;
  }>) =>
    request<Inspection>(`/api/inspections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Delete inspection
  delete: (id: string) =>
    request<{ success: boolean }>(`/api/inspections/${id}`, {
      method: 'DELETE',
    }),
};

// Inspection Checklist API
export const checklistApi = {
  // Update single checklist item
  update: (id: string, data: { status?: string; comment?: string; reference?: string }) =>
    request<InspectionChecklistItem>(`/api/inspection-checklist/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Bulk update checklist items
  bulkUpdate: (inspectionId: string, items: { id: string; status: string; comment?: string; reference?: string }[]) =>
    request<InspectionChecklistItem[]>(`/api/inspections/${inspectionId}/checklist`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    }),
};

// TML Measurement API
export const tmlApi = {
  // Add TML measurement
  create: (inspectionId: string, data: {
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
  }) =>
    request<TmlMeasurement>(`/api/inspections/${inspectionId}/tml`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Update TML measurement
  update: (id: string, data: Partial<{
    tmlNumber: number;
    objectType: string;
    activity: string;
    dimension: string;
    tNom: number;
    tRet: number;
    tAlert: number;
    tMeasured: number;
    position: string;
    comment: string;
  }>) =>
    request<TmlMeasurement>(`/api/inspection-tml/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Delete TML measurement
  delete: (id: string) =>
    request<{ success: boolean }>(`/api/inspection-tml/${id}`, {
      method: 'DELETE',
    }),
};

// Inspection Image API
export const inspectionImageApi = {
  // Upload image
  upload: async (inspectionId: string, file: File, comment?: string) => {
    const formData = new FormData();
    formData.append('image', file);
    if (comment) formData.append('comment', comment);

    return request<InspectionImage>(`/api/inspections/${inspectionId}/images`, {
      method: 'POST',
      body: formData,
    });
  },

  // Update image
  update: (id: string, data: { comment?: string; imageNumber?: number }) =>
    request<InspectionImage>(`/api/inspection-images/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Delete image
  delete: (id: string) =>
    request<{ success: boolean }>(`/api/inspection-images/${id}`, {
      method: 'DELETE',
    }),
};

// Helper to get PDF URL
export const getPdfUrl = (filename: string) => `${API_BASE}/uploads/${filename}`;

// Helper to get inspection image URL
export const getInspectionImageUrl = (filename: string) => `${API_BASE}/uploads/inspection-images/${filename}`;

// Helper to get inspection document URL
export const getInspectionDocumentUrl = (filename: string) => `${API_BASE}/uploads/inspection-documents/${filename}`;

// Inspection Document API
export const inspectionDocumentApi = {
  // Upload document
  upload: async (inspectionId: string, file: File, documentType?: string, description?: string) => {
    const formData = new FormData();
    formData.append('document', file);
    if (documentType) formData.append('documentType', documentType);
    if (description) formData.append('description', description);

    return request<InspectionDocument>(`/api/inspections/${inspectionId}/documents`, {
      method: 'POST',
      body: formData,
    });
  },

  // Update document
  update: (id: string, data: { description?: string; documentType?: string }) =>
    request<InspectionDocument>(`/api/inspection-documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Delete document
  delete: (id: string) =>
    request<{ success: boolean }>(`/api/inspection-documents/${id}`, {
      method: 'DELETE',
    }),
};

// Helper to map backend isolation plan to frontend format
function mapIsolationPlan(raw: any): IsolationPlan {
  return {
    id: raw.id,
    diagramId: raw.diagram_id,
    name: raw.name,
    description: raw.description,
    equipmentTag: raw.equipment_tag,
    workOrder: raw.work_order,
    status: raw.status,
    plannedStart: raw.planned_start,
    plannedEnd: raw.planned_end,
    actualStart: raw.actual_start,
    actualEnd: raw.actual_end,
    pointSize: raw.point_size,
    createdBy: raw.created_by,
    createdByName: raw.created_by_name,
    approvedBy: raw.approved_by,
    approvedByName: raw.approved_by_name,
    approvedAt: raw.approved_at,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    pointCount: raw.point_count,
    isolatedCount: raw.isolated_count,
    verifiedCount: raw.verified_count,
    diagramName: raw.diagram_name,
    locationName: raw.location_name,
    terminalCode: raw.terminal_code,
    points: raw.points?.map(mapIsolationPoint),
  };
}

// Helper to map backend isolation point to frontend format
// Backend returns some fields as camelCase (pointType, tagNumber etc) and some as snake_case
// We handle both cases here using || fallbacks
function mapIsolationPoint(raw: any): IsolationPoint {
  return {
    id: raw.id,
    planId: raw.plan_id || raw.planId,
    pointType: raw.point_type || raw.pointType,
    tagNumber: raw.tag_number || raw.tagNumber,
    description: raw.description,
    sequenceNumber: raw.sequence_number || raw.sequenceNumber,
    normalPosition: raw.normal_position || raw.normalPosition,
    isolatedPosition: raw.isolated_position || raw.isolatedPosition,
    x: raw.x,
    y: raw.y,
    color: raw.color,
    status: raw.status,
    label: raw.label,
    isolatedBy: raw.isolated_by || raw.isolatedBy,
    isolatedByName: raw.isolated_by_name || raw.isolatedByName,
    isolatedAt: raw.isolated_at || raw.isolatedAt,
    verifiedBy: raw.verified_by || raw.verifiedBy,
    verifiedByName: raw.verified_by_name || raw.verifiedByName,
    verifiedAt: raw.verified_at || raw.verifiedAt,
    restoredBy: raw.restored_by || raw.restoredBy,
    restoredByName: raw.restored_by_name || raw.restoredByName,
    restoredAt: raw.restored_at || raw.restoredAt,
    notes: raw.notes,
    createdAt: raw.created_at || raw.createdAt,
    updatedAt: raw.updated_at || raw.updatedAt,
  };
}

// Isolation Plan API
export const isolationPlanApi = {
  // Get all plans for a diagram
  getByDiagram: async (diagramId: string) => {
    const result = await request<any[]>(`/api/diagrams/${diagramId}/isolation-plans`);
    if (result.data) {
      return { data: result.data.map(mapIsolationPlan) };
    }
    return result as { data?: IsolationPlan[]; error?: string };
  },

  // Get single plan with all points
  getOne: async (planId: string) => {
    const result = await request<any>(`/api/isolation-plans/${planId}`);
    if (result.data) {
      return { data: mapIsolationPlan(result.data) };
    }
    return result as { data?: IsolationPlan; error?: string };
  },

  // Get all plans (for dashboard)
  getAll: async () => {
    const result = await request<any[]>('/api/isolation-plans');
    if (result.data) {
      return { data: result.data.map(mapIsolationPlan) };
    }
    return result as { data?: IsolationPlan[]; error?: string };
  },

  // Get all active plans (for dashboard)
  getActive: async () => {
    const result = await request<any[]>('/api/isolation-plans/active');
    if (result.data) {
      return { data: result.data.map(mapIsolationPlan) };
    }
    return result as { data?: IsolationPlan[]; error?: string };
  },

  // Create new plan
  create: async (diagramId: string, data: {
    name: string;
    description?: string;
    equipmentTag?: string;
    workOrder?: string;
    plannedStart?: string;
    plannedEnd?: string;
  }) => {
    const result = await request<any>(`/api/diagrams/${diagramId}/isolation-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (result.data) {
      return { data: mapIsolationPlan(result.data) };
    }
    return result as { data?: IsolationPlan; error?: string };
  },

  // Update plan
  update: async (planId: string, data: Partial<{
    name: string;
    description: string;
    equipmentTag: string;
    workOrder: string;
    status: IsolationPlanStatus;
    plannedStart: string;
    plannedEnd: string;
    actualStart: string;
    actualEnd: string;
    pointSize: number;
  }>) => {
    const result = await request<any>(`/api/isolation-plans/${planId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (result.data) {
      return { data: mapIsolationPlan(result.data) };
    }
    return result as { data?: IsolationPlan; error?: string };
  },

  // Approve plan (admin only)
  approve: async (planId: string) => {
    const result = await request<any>(`/api/isolation-plans/${planId}/approve`, {
      method: 'POST',
    });
    if (result.data) {
      return { data: mapIsolationPlan(result.data) };
    }
    return result as { data?: IsolationPlan; error?: string };
  },

  // Delete plan (admin only)
  delete: (planId: string) =>
    request<{ success: boolean }>(`/api/isolation-plans/${planId}`, {
      method: 'DELETE',
    }),
};

// Isolation Point API
export const isolationPointApi = {
  // Add point to plan
  create: async (planId: string, data: {
    pointType: IsolationPointType;
    tagNumber: string;
    description?: string;
    sequenceNumber: number;
    normalPosition?: string;
    isolatedPosition?: string;
    x: number;
    y: number;
    color?: string;
    notes?: string;
  }) => {
    const result = await request<any>(`/api/isolation-plans/${planId}/points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        point_type: data.pointType,
        tag_number: data.tagNumber,
        description: data.description,
        sequence_number: data.sequenceNumber,
        normal_position: data.normalPosition,
        isolated_position: data.isolatedPosition,
        points: JSON.stringify({ x: data.x, y: data.y }),
        color: data.color,
        notes: data.notes,
      }),
    });
    if (result.data) {
      return { data: mapIsolationPoint(result.data) };
    }
    return result as { data?: IsolationPoint; error?: string };
  },

  // Update point
  update: async (pointId: string, data: Partial<{
    pointType: IsolationPointType;
    tagNumber: string;
    description: string;
    sequenceNumber: number;
    normalPosition: string;
    isolatedPosition: string;
    x: number;
    y: number;
    color: string;
    notes: string;
  }>) => {
    const payload: any = {};
    if (data.pointType !== undefined) payload.point_type = data.pointType;
    if (data.tagNumber !== undefined) payload.tag_number = data.tagNumber;
    if (data.description !== undefined) payload.description = data.description;
    if (data.sequenceNumber !== undefined) payload.sequence_number = data.sequenceNumber;
    if (data.normalPosition !== undefined) payload.normal_position = data.normalPosition;
    if (data.isolatedPosition !== undefined) payload.isolated_position = data.isolatedPosition;
    if (data.x !== undefined && data.y !== undefined) {
      payload.points = JSON.stringify({ x: data.x, y: data.y });
    }
    if (data.color !== undefined) payload.color = data.color;
    if (data.notes !== undefined) payload.notes = data.notes;

    const result = await request<any>(`/api/isolation-points/${pointId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (result.data) {
      return { data: mapIsolationPoint(result.data) };
    }
    return result as { data?: IsolationPoint; error?: string };
  },

  // Mark point as isolated
  isolate: async (pointId: string) => {
    const result = await request<any>(`/api/isolation-points/${pointId}/isolate`, {
      method: 'POST',
    });
    if (result.data) {
      return { data: mapIsolationPoint(result.data) };
    }
    return result as { data?: IsolationPoint; error?: string };
  },

  // Verify isolation
  verify: async (pointId: string) => {
    const result = await request<any>(`/api/isolation-points/${pointId}/verify`, {
      method: 'POST',
    });
    if (result.data) {
      return { data: mapIsolationPoint(result.data) };
    }
    return result as { data?: IsolationPoint; error?: string };
  },

  // Restore point
  restore: async (pointId: string) => {
    const result = await request<any>(`/api/isolation-points/${pointId}/restore`, {
      method: 'POST',
    });
    if (result.data) {
      return { data: mapIsolationPoint(result.data) };
    }
    return result as { data?: IsolationPoint; error?: string };
  },

  // Delete point
  delete: (pointId: string) =>
    request<{ success: boolean }>(`/api/isolation-points/${pointId}`, {
      method: 'DELETE',
    }),
};
