import React from 'react';
import { Download, ExternalLink, FileText, QrCode } from 'lucide-react';
import { LinkEntry, wrapUrlForDisplay } from '../utils/documentLogic';
import { LoadedCertificate } from '../utils/pdfRenderer';

interface DocumentPreviewProps {
  certificate: LoadedCertificate | null;
  activeLinks: LinkEntry[];
  qrMap: Record<string, string>;
  isValid: boolean;
  isGeneratingPdf: boolean;
  onDownloadPdf: () => void;
  onOpenPdfNewTab: () => void;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  certificate,
  activeLinks,
  qrMap,
  isValid,
  isGeneratingPdf,
  onDownloadPdf,
  onOpenPdfNewTab,
}) => {
  const twoBlocks = activeLinks.length >= 2;

  return (
    <section
      id="preview-section"
      aria-label="معاينة الملف"
      className="flex flex-col gap-3"
    >
      {/* Simple Preview Header */}
      <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
        <span className="text-sm font-bold text-slate-900 whitespace-nowrap shrink-0">
          معاينة الملف
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenPdfNewTab}
            disabled={!isValid || isGeneratingPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>فتح في نافذة جديدة</span>
          </button>

          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={!isValid || isGeneratingPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تحميل PDF</span>
          </button>
        </div>
      </div>

      {/* A4 Sheet Viewport Container */}
      <div className="bg-slate-200/75 border border-slate-300/80 rounded-xl p-4 sm:p-6 flex flex-col items-center justify-center">
        <div
          dir="ltr"
          data-testid="a4-preview-sheet"
          className="w-full max-w-[540px] aspect-[210/297] bg-white shadow-sm border border-slate-300 px-6 sm:px-9 py-5 sm:py-7 flex flex-col items-center justify-start overflow-hidden select-text"
        >
          {/* 1. Certificate Area at Top */}
          {certificate ? (
            <div
              className={`w-full flex items-center justify-center ${
                twoBlocks ? 'max-h-[43%]' : 'max-h-[55%]'
              }`}
            >
              <img
                src={certificate.dataUrl}
                alt={`معاينة الشهادة: ${certificate.fileName}`}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-full w-auto h-auto object-contain"
              />
            </div>
          ) : (
            <div
              className="w-full h-[43%] border border-dashed border-slate-300 rounded-lg bg-slate-50 flex flex-col items-center justify-center p-4 text-center"
              dir="rtl"
            >
              <FileText className="w-8 h-8 text-slate-300 mb-1.5" />
              <p className="text-xs font-medium text-slate-400">الشهادة</p>
            </div>
          )}

          {/* 2. Links + QR Codes Area Below Certificate */}
          {activeLinks.length > 0 ? (
            <div
              className={`w-full flex flex-col items-center ${
                twoBlocks ? 'mt-3.5 gap-3.5 sm:gap-4' : 'mt-7 gap-6'
              }`}
            >
              {activeLinks.map((link) => {
                const wrappedLines = wrapUrlForDisplay(link.url, 115);
                const qrDataUrl = qrMap[link.id];

                return (
                  <div
                    key={link.id}
                    data-testid={`preview-block-${link.id}`}
                    className="w-full flex flex-col items-center text-center"
                  >
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight mb-0.5 font-sans">
                      {link.heading}
                    </h3>

                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[6.5px] sm:text-[8px] leading-relaxed text-blue-700 hover:underline max-w-full mb-2 font-sans"
                    >
                      {wrappedLines.map((line, idx) => (
                        <span
                          key={idx}
                          className="block sm:whitespace-nowrap break-all sm:break-normal"
                        >
                          {line}
                        </span>
                      ))}
                    </a>

                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`QR Code for ${link.heading}`}
                        referrerPolicy="no-referrer"
                        className={`${
                          twoBlocks
                            ? 'w-20 h-20 sm:w-24 sm:h-24'
                            : 'w-28 h-28 sm:w-36 sm:h-36'
                        } object-contain bg-white`}
                      />
                    ) : (
                      <div
                        className={`${
                          twoBlocks
                            ? 'w-20 h-20 sm:w-24 sm:h-24'
                            : 'w-28 h-28 sm:w-36 sm:h-36'
                        } bg-slate-100 flex items-center justify-center`}
                      >
                        <QrCode className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              dir="rtl"
              className="w-full flex-1 flex flex-col items-center justify-center text-center p-4 mt-4 border border-dashed border-slate-200 rounded-lg bg-slate-50/50"
            >
              <QrCode className="w-7 h-7 text-slate-300 mb-1.5" />
              <p className="text-xs font-medium text-slate-400">الروابط ورموز الـ QR</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
