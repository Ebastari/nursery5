import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist';
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
import { QRCodeOverlay } from './QRCodeOverlay';

interface DocumentPreviewProps {
  url: string;
  type?: 'pdf' | 'image';
  height?: number;
  ttdSopir?: boolean;
  showQrCode?: boolean;
  qrValue?: string;
  showCentang?: boolean;
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({ 
  url, 
  type = 'pdf', 
  height = 500, 
  ttdSopir,
  showQrCode = false,
  qrValue = '',
  showCentang = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.2);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);

  const renderPage = useCallback(async () => {
    if (!pdfDocRef.current || !canvasRef.current || pageNum > numPages || pageNum < 1) {
      return;
    }

    setLoading(true);
    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Responsive sizing
      const container = containerRef.current;
      if (container) {
        const maxWidth = Math.min(container.clientWidth, 800);
        const scaleX = maxWidth / viewport.width;
        const newScale = Math.min(scale, scaleX);
        canvas.style.maxWidth = `${viewport.width * newScale}px`;
        canvas.style.height = `${viewport.height * newScale}px`;
      }

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      };

      await page.render(renderContext).promise;
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal render halaman');
      setLoading(false);
    }
  }, [pageNum, numPages, scale]);

  const loadDocument = useCallback(async () => {
    if (!url || type !== 'pdf') return;

    setLoading(true);
    setError(null);
    setNumPages(0);
    setPageNum(1);

    try {
      const loadingTask = pdfjs.getDocument({
        url,
        httpHeaders: { 'Access-Control-Allow-Origin': '*' },
        withCredentials: false,
      });

      const pdfDoc = await loadingTask.promise;
      pdfDocRef.current = pdfDoc;
      setNumPages(pdfDoc.numPages);
      await renderPage();
    } catch (err: unknown) {
      console.error('PDF load error:', err);
      setError(err instanceof Error ? err.message : 'Gagal memuat PDF');
    } finally {
      setLoading(false);
    }
  }, [url, type, renderPage]);
  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  const handlePrevPage = () => {
    if (pageNum > 1) setPageNum(pageNum - 1);
  };

  const handleNextPage = () => {
    if (pageNum < numPages) setPageNum(pageNum + 1);
  };

  const handleZoomIn = () => setScale(Math.min(scale + .2, 2.5));
  const handleZoomOut = () => setScale(Math.max(scale - .2, .5));

  const ResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div 
      ref={containerRef}
      className="w-full max-w-4xl mx-auto overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent p-4"
      style={{ maxHeight: `${height}px` }}
    >
      {children}
    </div>
  );

  if (!url) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <p className="text-sm text-gray-400 italic">Tidak ada dokumen untuk ditampilkan</p>
      </div>
    );
  }

  if (type === 'image') {
    return (
      <ResponsiveContainer>
        <img 
          src={url} 
          alt="Preview Dokumen" 
          className="w-full h-auto max-h-full rounded-xl border border-gray-200 shadow-sm object-contain block mx-auto bg-gradient-to-br from-gray-50/50"
          onError={() => setError('Gagal memuat gambar')}
        />
      </ResponsiveContainer>
    );
  }

  return (
    <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* TTD Sopir Badge */}
      {ttdSopir && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-emerald-200 shadow-lg">
          <svg className="w-4 h-4 text-emerald-500 fill-current" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7"/>
          </svg>
          <span className="text-xs font-semibold text-emerald-700">TTD Sopir ✓</span>
        </div>
      )}

      {/* QR Code Overlay */}
      {showQrCode && qrValue && (
        <div className="absolute bottom-4 right-4 z-30">
          <QRCodeOverlay value={qrValue} size={72} />
        </div>
      )}

      {/* Centang Overlay (visual, kanan bawah) */}
      {showCentang && (
        <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 bg-white/90 px-3 py-1.5 rounded-lg border border-emerald-200 shadow">
          <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-xs font-semibold text-emerald-700">Disetujui</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"/>
          <p className="text-sm text-gray-600 font-medium">Memuat PDF...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-red-50 to-red-100 z-10 p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-red-800 mb-1">Gagal memuat PDF</p>
          <p className="text-xs text-red-600 mb-4 max-w-sm">{error}</p>
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10l-5.5 5.5h11l-5.5-5.5z" />
            </svg>
            Unduh & Buka PDF
          </a>
        </div>
      )}

      {/* PDF Controls */}
      {numPages > 1 && !loading && !error && (
        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl border shadow-lg flex items-center gap-3 z-10">
          <button
            onClick={handlePrevPage}
            disabled={pageNum <= 1}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1 text-sm"
            title="Halaman sebelumnya"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <span className="text-sm font-semibold text-gray-800 min-w-[60px] text-center">
            {pageNum} / {numPages}
          </span>
          
          <button
            onClick={handleNextPage}
            disabled={pageNum >= numPages}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1 text-sm"
            title="Halaman selanjutnya"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="h-6 w-px bg-gray-300 mx-3"/>

          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all flex items-center gap-1 text-xs"
            title="Perbesar (Ctrl +)"
          >
            ➕
          </button>
          
          <span className="text-xs text-gray-600 min-w-[25px] text-center">{Math.round(scale * 100)}%</span>
          
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all flex items-center gap-1 text-xs"
            title="Perkecil (Ctrl -)"
          >
            ➖
          </button>
        </div>
      )}

      {/* PDF Canvas */}
      {!loading && !error && (
        <ResponsiveContainer>
          <canvas
            ref={canvasRef}
            className="block mx-auto shadow-inner bg-gradient-to-br from-gray-50 to-white"
          />
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default DocumentPreview;

