import React, { useRef } from 'react';
import {
  Upload,
  Link2,
  AlertCircle,
  Trash2,
  Download,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
} from 'lucide-react';
import { ValidationResult } from '../utils/documentLogic';
import { LoadedCertificate } from '../utils/pdfRenderer';

interface CertificateFormProps {
  certificate: LoadedCertificate | null;
  isLoadingFile: boolean;
  fileError: string | null;
  certificateLink: string;
  verificationLink: string;
  outputFileName: string;
  validation: ValidationResult;
  isGeneratingPdf: boolean;
  onFileSelected: (file: File) => void;
  onChangePdfPage: (newPage: number) => void;
  onRemoveCertificate: () => void;
  onResetAll: () => void;
  onCertificateLinkChange: (val: string) => void;
  onVerificationLinkChange: (val: string) => void;
  onOutputFileNameChange: (val: string) => void;
  onDownloadPdf: () => void;
}

export const CertificateForm: React.FC<CertificateFormProps> = ({
  certificate,
  isLoadingFile,
  fileError,
  certificateLink,
  verificationLink,
  outputFileName,
  validation,
  isGeneratingPdf,
  onFileSelected,
  onChangePdfPage,
  onRemoveCertificate,
  onResetAll,
  onCertificateLinkChange,
  onVerificationLinkChange,
  onOutputFileNameChange,
  onDownloadPdf,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  const hasAnyInput =
    certificate !== null ||
    certificateLink.trim() !== '' ||
    verificationLink.trim() !== '' ||
    outputFileName.trim() !== '';

  return (
    <div id="upload-section" className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-6">
      {/* 1. Certificate Upload */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <label className="text-sm font-bold text-slate-900">
            الشهادة (PDF أو صورة) <span className="text-red-600">*</span>
          </label>
          {hasAnyInput && (
            <button
              type="button"
              onClick={onResetAll}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>مسح الكل</span>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          id="certificate-upload-input"
          type="file"
          accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="رفع ملف الشهادة"
        />

        {!certificate ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-blue-600 rounded-xl p-6 text-center bg-slate-50/70 transition-colors cursor-pointer"
          >
            <Upload className="w-7 h-7 text-blue-700 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800 mb-3">
              اسحب ملف الشهادة هنا أو اضغط لاختيار ملف
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={isLoadingFile}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isLoadingFile ? 'جاري القراءة...' : 'اختيار ملف'}
            </button>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-9 rounded border border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center">
                  <img
                    src={certificate.dataUrl}
                    alt="صورة مصغرة للشهادة"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate" dir="ltr">
                    {certificate.fileName}
                  </p>
                  <p className="text-xs text-slate-500 font-mono tabular-nums" dir="ltr">
                    {certificate.width}×{certificate.height}px
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  تغيير
                </button>
                <button
                  type="button"
                  onClick={onRemoveCertificate}
                  aria-label="حذف الشهادة المرفوعة"
                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {certificate.fileType === 'pdf' && certificate.pageCount > 1 && (
              <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>صفحة الشهادة:</span>
                <div className="flex items-center gap-2 font-mono tabular-nums">
                  <button
                    type="button"
                    disabled={certificate.currentPage <= 1 || isLoadingFile}
                    onClick={() => onChangePdfPage(certificate.currentPage - 1)}
                    aria-label="الصفحة السابقة"
                    className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <span>
                    {certificate.currentPage} / {certificate.pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={certificate.currentPage >= certificate.pageCount || isLoadingFile}
                    onClick={() => onChangePdfPage(certificate.currentPage + 1)}
                    aria-label="الصفحة التالية"
                    className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {fileError && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{fileError}</span>
          </div>
        )}
      </div>

      {/* 2. Links */}
      <div className="flex flex-col gap-4 pt-4 border-t border-slate-100">
        <div>
          <label
            htmlFor="certificate-link-input"
            className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-1.5"
          >
            <Link2 className="w-4 h-4 text-blue-700" />
            <span>رابط الشهادة (Certificate Link)</span>
          </label>
          <input
            id="certificate-link-input"
            type="url"
            dir="ltr"
            value={certificateLink}
            onChange={(e) => onCertificateLinkChange(e.target.value)}
            placeholder="https://..."
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-colors"
          />
          {validation.certificateLinkError && (
            <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1.5" role="alert">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{validation.certificateLinkError}</span>
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="verification-link-input"
            className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-1.5"
          >
            <Link2 className="w-4 h-4 text-blue-700" />
            <span>رابط توثيق الكورس (Verification Link)</span>
          </label>
          <input
            id="verification-link-input"
            type="url"
            dir="ltr"
            value={verificationLink}
            onChange={(e) => onVerificationLinkChange(e.target.value)}
            placeholder="https://..."
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-colors"
          />
          {validation.verificationLinkError && (
            <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1.5" role="alert">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{validation.verificationLinkError}</span>
            </p>
          )}
        </div>
      </div>

      {/* 3. Output Filename & Download */}
      <div className="pt-4 border-t border-slate-100 flex flex-col gap-4">
        <div>
          <label
            htmlFor="output-filename-input"
            className="block text-sm font-bold text-slate-900 mb-1.5"
          >
            اسم الملف النهائي (اختياري)
          </label>
          <div className="flex items-center gap-2" dir="ltr">
            <input
              id="output-filename-input"
              type="text"
              value={outputFileName}
              onChange={(e) => onOutputFileNameChange(e.target.value)}
              placeholder="certificate"
              className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
            <span className="text-xs font-mono text-slate-500 shrink-0">.pdf</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onDownloadPdf}
          disabled={!validation.isValid || isGeneratingPdf}
          className="w-full py-3 px-5 text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-45 disabled:pointer-events-none rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>{isGeneratingPdf ? 'جاري التجهيز...' : 'تحميل ملف الـ PDF'}</span>
        </button>
      </div>
    </div>
  );
};
