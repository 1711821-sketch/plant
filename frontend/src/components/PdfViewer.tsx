import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { RenderTask, PDFDocumentProxy } from 'pdfjs-dist';

// Set worker using CDN with correct version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  pdfUrl: string;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  scale?: number;
}

export function PdfViewer({ pdfUrl, onCanvasReady, scale = 1.5 }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState<{ current: number; total: number }>({ current: 1, total: 1 });

  // Memoize onCanvasReady to prevent unnecessary re-renders
  const stableOnCanvasReady = useCallback(onCanvasReady, []);

  useEffect(() => {
    let isCancelled = false;

    const loadPdf = async () => {
      if (!canvasRef.current || !pdfUrl) return;

      // Cancel any existing render operation
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancellation errors
        }
        renderTaskRef.current = null;
      }

      // Destroy previous PDF document
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch {
          // Ignore destroy errors
        }
        pdfDocRef.current = null;
      }

      setLoading(true);
      setError(null);

      try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        if (isCancelled) {
          pdf.destroy();
          return;
        }

        pdfDocRef.current = pdf;
        setPageInfo({ current: 1, total: pdf.numPages });

        const page = await pdf.getPage(1);

        if (isCancelled) {
          return;
        }

        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Could not get canvas context');
        }

        // Clear the canvas before resizing
        context.clearRect(0, 0, canvas.width, canvas.height);

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;

        if (isCancelled) {
          return;
        }

        renderTaskRef.current = null;
        setLoading(false);
        stableOnCanvasReady(canvas);
      } catch (err) {
        if (isCancelled) return;

        // Ignore cancellation errors
        if (err instanceof Error && err.message.includes('cancelled')) {
          return;
        }

        console.error('Error loading PDF:', err);
        setError(err instanceof Error ? err.message : 'Kunne ikke indlæse PDF');
        setLoading(false);
      }
    };

    loadPdf();

    // Cleanup function
    return () => {
      isCancelled = true;

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancellation errors
        }
        renderTaskRef.current = null;
      }

      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch {
          // Ignore destroy errors
        }
        pdfDocRef.current = null;
      }
    };
  }, [pdfUrl, scale, stableOnCanvasReady]);

  return (
    <div className="pdf-viewer">
      {loading && (
        <div className="pdf-loading">
          <div className="spinner"></div>
          <p>Indlæser PDF...</p>
        </div>
      )}
      {error && (
        <div className="pdf-error">
          <p>Fejl: {error}</p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{ display: loading ? 'none' : 'block' }}
      />
      {!loading && !error && (
        <div className="page-info">
          Side {pageInfo.current} af {pageInfo.total}
        </div>
      )}
    </div>
  );
}
