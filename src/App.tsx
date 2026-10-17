/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { validateSubmission } from './utils/documentLogic';
import {
  LoadedCertificate,
  generateQrDataUrl,
  loadImageFile,
  loadPdfFile,
  renderPdfPageFromBuffer,
  buildCombinedPdfDocument,
} from './utils/pdfRenderer';
import { CertificateForm } from './components/CertificateForm';
import { DocumentPreview } from './components/DocumentPreview';

export default function App() {
  const [certificate, setCertificate] = useState<LoadedCertificate | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const [certificateLink, setCertificateLink] = useState<string>('');
  const [verificationLink, setVerificationLink] = useState<string>('');
  const [outputFileName, setOutputFileName] = useState<string>('');

  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const validation = validateSubmission({
    hasCertificate: certificate !== null,
    certificateLink,
    verificationLink,
  });

  // Regenerate QR codes whenever valid links change
  useEffect(() => {
    let cancelled = false;
    async function updateQrCodes() {
      const nextMap: Record<string, string> = {};
      for (const item of validation.activeLinks) {
        try {
          nextMap[item.id] = await generateQrDataUrl(item.url);
        } catch {
          // Ignore invalid intermediate QR error
        }
      }
      if (!cancelled) {
        setQrMap(nextMap);
      }
    }
    updateQrCodes();
    return () => {
      cancelled = true;
    };
  }, [certificateLink, verificationLink, validation.activeLinks.length]);

  const handleFileSelected = useCallback(async (file: File) => {
    setIsLoadingFile(true);
    setFileError(null);

    try {
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage =
        file.type.startsWith('image/') ||
        /\.(png|jpe?g|webp)$/i.test(file.name);

      if (!isPdf && !isImage) {
        throw new Error('يرجى اختيار ملف بصيغة PDF أو صورة (PNG, JPG, WEBP).');
      }

      const loaded = isPdf ? await loadPdfFile(file) : await loadImageFile(file);
      setCertificate(loaded);

      const baseName = file.name.replace(/\.[^/.]+$/, '');
      if (baseName) {
        setOutputFileName((prev) => (prev.trim() ? prev : `${baseName}-verified`));
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'حدث خطأ أثناء قراءة ملف الشهادة.';
      setFileError(message);
    } finally {
      setIsLoadingFile(false);
    }
  }, []);

  const handleChangePdfPage = useCallback(
    async (newPage: number) => {
      if (!certificate || !certificate.rawPdfBuffer) return;
      setIsLoadingFile(true);
      setFileError(null);
      try {
        const rendered = await renderPdfPageFromBuffer(
          certificate.rawPdfBuffer,
          certificate.fileName,
          newPage
        );
        setCertificate(rendered);
      } catch (err) {
        setFileError(
          err instanceof Error ? err.message : 'تعذر عرض الصفحة المطلوبة من ملف PDF.'
        );
      } finally {
        setIsLoadingFile(false);
      }
    },
    [certificate]
  );

  const handleResetAll = useCallback(() => {
    setFileError(null);
    setCertificate(null);
    setCertificateLink('');
    setVerificationLink('');
    setOutputFileName('');
    setQrMap({});
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    if (!certificate || !validation.isValid) return;
    setIsGeneratingPdf(true);
    try {
      const doc = await buildCombinedPdfDocument({
        certificate,
        activeLinks: validation.activeLinks,
        qrMap,
      });
      const cleanName =
        outputFileName.trim().replace(/\.pdf$/i, '') || 'certificate';
      doc.save(`${cleanName}.pdf`);
    } catch (err) {
      setFileError(
        err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء ملف الـ PDF.'
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [certificate, validation.isValid, validation.activeLinks, qrMap, outputFileName]);

  const handleOpenPdfNewTab = useCallback(async () => {
    if (!certificate || !validation.isValid) return;
    setIsGeneratingPdf(true);
    try {
      const doc = await buildCombinedPdfDocument({
        certificate,
        activeLinks: validation.activeLinks,
        qrMap,
      });
      const blob = doc.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch (err) {
      setFileError(
        err instanceof Error ? err.message : 'تعذر فتح معاينة ملف الـ PDF.'
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [certificate, validation.isValid, validation.activeLinks, qrMap]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 font-display">
            توثيق شهادة التدريب الصيفي
          </h1>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!validation.isValid || isGeneratingPdf}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            تحميل PDF
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5">
            <CertificateForm
              certificate={certificate}
              isLoadingFile={isLoadingFile}
              fileError={fileError}
              certificateLink={certificateLink}
              verificationLink={verificationLink}
              outputFileName={outputFileName}
              validation={validation}
              isGeneratingPdf={isGeneratingPdf}
              onFileSelected={handleFileSelected}
              onChangePdfPage={handleChangePdfPage}
              onRemoveCertificate={() => setCertificate(null)}
              onResetAll={handleResetAll}
              onCertificateLinkChange={setCertificateLink}
              onVerificationLinkChange={setVerificationLink}
              onOutputFileNameChange={setOutputFileName}
              onDownloadPdf={handleDownloadPdf}
            />
          </div>

          <div className="lg:col-span-7">
            <DocumentPreview
              certificate={certificate}
              activeLinks={validation.activeLinks}
              qrMap={qrMap}
              isValid={validation.isValid}
              isGeneratingPdf={isGeneratingPdf}
              onDownloadPdf={handleDownloadPdf}
              onOpenPdfNewTab={handleOpenPdfNewTab}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
