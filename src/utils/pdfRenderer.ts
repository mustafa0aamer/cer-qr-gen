import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { calculatePdfLayout, LinkEntry } from './documentLogic';

// Configure local bundled worker for pdfjs-dist (works offline and on GitHub Pages)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface LoadedCertificate {
  fileName: string;
  fileType: 'pdf' | 'image' | 'sample';
  dataUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
  pageCount: number;
  currentPage: number;
  rawPdfBuffer?: ArrayBuffer;
}

/**
 * Generates a high-resolution QR code PNG data URL for a given link.
 */
export async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 600,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}

/**
 * Loads an uploaded image file into a clean high-resolution data URL with dimensions.
 */
export async function loadImageFile(file: File): Promise<LoadedCertificate> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
    reader.onload = () => {
      const resultStr = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('ملف الصورة غير صالح أو تالف.'));
      img.onload = () => {
        const maxDim = 2200;
        let targetW = img.naturalWidth || 1600;
        let targetH = img.naturalHeight || 1130;
        if (targetW > maxDim || targetH > maxDim) {
          const scale = maxDim / Math.max(targetW, targetH);
          targetW = Math.round(targetW * scale);
          targetH = Math.round(targetH * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('تعذر إنشاء سياق الرسم للصورة.'));
          return;
        }
        // Fill white background in case of transparent PNG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        resolve({
          fileName: file.name,
          fileType: 'image',
          dataUrl,
          width: targetW,
          height: targetH,
          aspectRatio: targetW / targetH,
          pageCount: 1,
          currentPage: 1,
        });
      };
      img.src = resultStr;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Renders a specific page of a PDF ArrayBuffer to a high-resolution data URL.
 */
export async function renderPdfPageFromBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  pageNumber = 1
): Promise<LoadedCertificate> {
  // Clone buffer so pdfjs worker transfer doesn't detach the stored copy
  const bufferCopy = buffer.slice(0);
  const loadingTask = pdfjsLib.getDocument({ data: bufferCopy });
  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const safePage = Math.min(Math.max(1, pageNumber), pageCount);
  const page = await pdfDoc.getPage(safePage);

  const baseViewport = page.getViewport({ scale: 1 });
  // Target ~2000px width for crisp print quality
  const desiredScale = Math.min(3.0, Math.max(1.8, 2000 / baseViewport.width));
  const viewport = page.getViewport({ scale: desiredScale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('تعذر تهيئة معاينة ملف PDF.');
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  }).promise;

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  return {
    fileName,
    fileType: 'pdf',
    dataUrl,
    width: canvas.width,
    height: canvas.height,
    aspectRatio: canvas.width / canvas.height,
    pageCount,
    currentPage: safePage,
    rawPdfBuffer: buffer,
  };
}

/**
 * Loads an uploaded PDF file and renders its first page.
 */
export async function loadPdfFile(file: File): Promise<LoadedCertificate> {
  const arrayBuffer = await file.arrayBuffer();
  return renderPdfPageFromBuffer(arrayBuffer, file.name, 1);
}

/**
 * Builds the final combined A4 Portrait PDF document containing:
 * 1. The uploaded Certificate at the top
 * 2. Each provided Link (Certificate Link and/or Verification Link) with clickable blue URL text and QR Code below it.
 */
export async function buildCombinedPdfDocument(params: {
  certificate: LoadedCertificate;
  activeLinks: LinkEntry[];
  qrMap: Record<string, string>;
}): Promise<jsPDF> {
  const { certificate, activeLinks, qrMap } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const layout = calculatePdfLayout({
    certAspectRatio: certificate.aspectRatio,
    activeLinks,
  });

  // White page background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, layout.pageWidthMm, layout.pageHeightMm, 'F');

  // 1. Draw Certificate Image at top
  doc.addImage(
    certificate.dataUrl,
    'JPEG',
    layout.certX,
    layout.certY,
    layout.certWidth,
    layout.certHeight,
    undefined,
    'FAST'
  );

  // 2. Draw each Link + QR Block centered below the certificate
  for (const block of layout.blocks) {
    // Heading (e.g., "Certificate Link" or "Verification Link")
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14.5);
    doc.setTextColor(17, 24, 39); // #111827 near-black
    doc.text(block.heading, layout.pageWidthMm / 2, block.headingY, {
      align: 'center',
    });

    // Clickable Blue URL lines
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(29, 78, 216); // #1D4ED8 blue

    block.urlLines.forEach((line, index) => {
      const lineY = block.urlStartY + index * block.urlLineHeight;
      doc.text(line, layout.pageWidthMm / 2, lineY, {
        align: 'center',
      });
    });

    // Add clickable annotation box covering all lines of the URL
    const totalUrlHeight = block.urlLines.length * block.urlLineHeight;
    doc.link(
      14,
      block.urlStartY - 3.5,
      layout.pageWidthMm - 28,
      totalUrlHeight + 2,
      { url: block.url }
    );

    // Draw QR Code centered below the URL
    const qrDataUrl = qrMap[block.id] || (await generateQrDataUrl(block.url));
    doc.addImage(
      qrDataUrl,
      'PNG',
      block.qrX,
      block.qrY,
      block.qrSize,
      block.qrSize,
      undefined,
      'FAST'
    );

    // Also make the QR code itself clickable in the PDF
    doc.link(block.qrX, block.qrY, block.qrSize, block.qrSize, {
      url: block.url,
    });
  }

  return doc;
}
