import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Diagram, PipeAnnotation, AnnotationType } from '../types';
import { diagramApi, annotationApi, getPdfUrl } from '../api/client';

export type DrawingTool = 'select' | 'draw-free' | 'draw-line' | 'pan';

interface AppState {
  // Diagrams
  diagrams: Diagram[];
  currentDiagramId: string | null;
  isLoading: boolean;
  error: string | null;

  // Drawing mode
  isDrawing: boolean;
  currentTool: DrawingTool;

  // Zoom
  zoom: number;

  // Selected annotation
  selectedAnnotationId: string | null;

  // Diagram locked mode (hides all highlights, shows only selected)
  isLocked: boolean;

  // Global inspection type filter
  activeInspectionType: AnnotationType;

  // Actions
  setActiveInspectionType: (type: AnnotationType) => void;
  fetchDiagrams: () => Promise<void>;
  fetchDiagram: (id: string) => Promise<void>;
  uploadDiagram: (file: File, name?: string) => Promise<void>;
  deleteDiagram: (id: string) => Promise<void>;
  setCurrentDiagram: (id: string | null) => void;

  addAnnotation: (diagramId: string, annotation: Omit<PipeAnnotation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateAnnotation: (diagramId: string, annotationId: string, updates: Partial<PipeAnnotation>) => Promise<void>;
  deleteAnnotation: (diagramId: string, annotationId: string) => Promise<void>;

  setCurrentTool: (tool: DrawingTool) => void;
  setSelectedAnnotation: (id: string | null) => void;
  setIsDrawing: (isDrawing: boolean) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  clearError: () => void;
  toggleLock: () => void;
  setLocked: (locked: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
  diagrams: [],
  currentDiagramId: null,
  isLoading: false,
  error: null,
  isDrawing: false,
  currentTool: 'select',
  zoom: 1,
  selectedAnnotationId: null,
  isLocked: false,
  activeInspectionType: 'pipe',

  setActiveInspectionType: (type) => set({
    activeInspectionType: type,
    selectedAnnotationId: null, // Clear selection when switching inspection type
  }),

  fetchDiagrams: async () => {
    set({ isLoading: true, error: null });
    const { data, error } = await diagramApi.getAll();
    if (error) {
      set({ error, isLoading: false });
    } else {
      set({ diagrams: data || [], isLoading: false });
    }
  },

  fetchDiagram: async (id: string) => {
    set({ isLoading: true, error: null });
    const { data, error } = await diagramApi.getOne(id);
    if (error) {
      set({ error, isLoading: false });
    } else if (data) {
      const diagram: Diagram = {
        id: data.id,
        name: data.name,
        pdfUrl: getPdfUrl(data.pdf_filename),
        locationId: data.location_id,
        locationName: data.location_name,
        terminalCode: data.terminal_code,
        annotations: data.annotations.map((a: any) => ({
          id: a.id,
          annotationType: a.annotation_type || 'pipe',
          kksNumber: a.kks_number,
          points: a.points,
          color: a.color,
          strokeWidth: a.stroke_width,
          description: a.description,
          material: a.material,
          diameter: a.diameter,
          lastInspection: a.last_inspection,
          nextInspection: a.next_inspection,
          status: a.status,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        })),
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      set((state) => ({
        diagrams: state.diagrams.some((d) => d.id === id)
          ? state.diagrams.map((d) => (d.id === id ? diagram : d))
          : [...state.diagrams, diagram],
        currentDiagramId: id,
        isLoading: false,
      }));
    }
  },

  uploadDiagram: async (file: File, name?: string) => {
    set({ isLoading: true, error: null });
    const { data, error } = await diagramApi.create(file, name);
    if (error) {
      set({ error, isLoading: false });
    } else if (data) {
      const diagram: Diagram = {
        id: data.id,
        name: data.name,
        pdfUrl: getPdfUrl(data.pdf_filename),
        annotations: [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      set((state) => ({
        diagrams: [...state.diagrams, diagram],
        currentDiagramId: diagram.id,
        isLoading: false,
      }));
    }
  },

  deleteDiagram: async (id: string) => {
    const { error } = await diagramApi.delete(id);
    if (error) {
      set({ error });
    } else {
      set((state) => ({
        diagrams: state.diagrams.filter((d) => d.id !== id),
        currentDiagramId: state.currentDiagramId === id ? null : state.currentDiagramId,
      }));
    }
  },

  setCurrentDiagram: (id) => set({ currentDiagramId: id, selectedAnnotationId: null }),

  addAnnotation: async (diagramId, annotationData) => {
    const { data, error } = await annotationApi.create(diagramId, {
      kksNumber: annotationData.kksNumber,
      points: annotationData.points,
      color: annotationData.color,
      strokeWidth: annotationData.strokeWidth,
      description: annotationData.description,
      material: annotationData.material,
      diameter: annotationData.diameter,
      status: annotationData.status,
    });

    if (error) {
      set({ error });
    } else if (data) {
      const annotation: PipeAnnotation = {
        id: data.id,
        annotationType: data.annotation_type || 'pipe',
        kksNumber: data.kks_number,
        points: data.points,
        color: data.color,
        strokeWidth: data.stroke_width,
        description: data.description,
        material: data.material,
        diameter: data.diameter,
        lastInspection: data.last_inspection,
        nextInspection: data.next_inspection,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      set((state) => ({
        diagrams: state.diagrams.map((d) =>
          d.id === diagramId
            ? { ...d, annotations: [...d.annotations, annotation] }
            : d
        ),
        selectedAnnotationId: annotation.id,
      }));
    }
  },

  updateAnnotation: async (diagramId, annotationId, updates) => {
    const { data, error } = await annotationApi.update(annotationId, updates);

    if (error) {
      set({ error });
    } else if (data) {
      const updatedAnnotation: PipeAnnotation = {
        id: data.id,
        annotationType: data.annotation_type || 'pipe',
        kksNumber: data.kks_number,
        points: data.points,
        color: data.color,
        strokeWidth: data.stroke_width,
        description: data.description,
        material: data.material,
        diameter: data.diameter,
        lastInspection: data.last_inspection,
        nextInspection: data.next_inspection,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      set((state) => ({
        diagrams: state.diagrams.map((d) =>
          d.id === diagramId
            ? {
                ...d,
                annotations: d.annotations.map((a) =>
                  a.id === annotationId ? updatedAnnotation : a
                ),
              }
            : d
        ),
      }));
    }
  },

  deleteAnnotation: async (diagramId, annotationId) => {
    const { error } = await annotationApi.delete(annotationId);

    if (error) {
      set({ error });
    } else {
      set((state) => ({
        diagrams: state.diagrams.map((d) =>
          d.id === diagramId
            ? {
                ...d,
                annotations: d.annotations.filter((a) => a.id !== annotationId),
              }
            : d
        ),
        selectedAnnotationId:
          state.selectedAnnotationId === annotationId ? null : state.selectedAnnotationId,
      }));
    }
  },

  setCurrentTool: (tool) => set({ currentTool: tool }),
  setSelectedAnnotation: (id) => set({ selectedAnnotationId: id }),
  setIsDrawing: (isDrawing) => set({ isDrawing }),
  setZoom: (zoom) => set({ zoom: Math.min(Math.max(zoom, 0.25), 4) }),
  zoomIn: () => set((state) => ({ zoom: Math.min(state.zoom * 1.25, 4) })),
  zoomOut: () => set((state) => ({ zoom: Math.max(state.zoom / 1.25, 0.25) })),
  resetZoom: () => set({ zoom: 1 }),
  clearError: () => set({ error: null }),
  toggleLock: () => set((state) => ({
    isLocked: !state.isLocked,
    selectedAnnotationId: null, // Clear selection when toggling lock
    currentTool: !state.isLocked ? 'select' : state.currentTool, // Switch to select when locking
  })),
  setLocked: (locked) => set({
    isLocked: locked,
    selectedAnnotationId: null,
    currentTool: locked ? 'select' : 'select',
  }),
}),
    {
      name: 'inspection-app-storage',
      partialize: (state) => ({ activeInspectionType: state.activeInspectionType }),
    }
  )
);
