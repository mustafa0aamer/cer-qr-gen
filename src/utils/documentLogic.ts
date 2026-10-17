export interface LinkEntry {
  id: 'certificate' | 'verification';
  heading: string;
  arabicLabel: string;
  url: string;
}

export interface ValidationResult {
  isValid: boolean;
  hasCertificate: boolean;
  hasAtLeastOneLink: boolean;
  certificateLinkError: string | null;
  verificationLinkError: string | null;
  generalError: string | null;
  activeLinks: LinkEntry[];
}

export interface PdfLinkBlockLayout {
  id: 'certificate' | 'verification';
  heading: string;
  url: string;
  urlLines: string[];
  headingY: number;
  urlStartY: number;
  urlLineHeight: number;
  qrX: number;
  qrY: number;
  qrSize: number;
}

export interface PdfPageLayout {
  pageWidthMm: number;
  pageHeightMm: number;
  certX: number;
  certY: number;
  certWidth: number;
  certHeight: number;
  blocks: PdfLinkBlockLayout[];
}

/**
 * Normalizes a user-entered URL string and checks whether it is a valid http/https URL.
 */
export function normalizeAndValidateUrl(rawInput: string): {
  isEmpty: boolean;
  isValid: boolean;
  normalizedUrl: string;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { isEmpty: true, isValid: false, normalizedUrl: '' };
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isEmpty: false, isValid: false, normalizedUrl: trimmed };
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return { isEmpty: false, isValid: false, normalizedUrl: trimmed };
    }
    return { isEmpty: false, isValid: true, normalizedUrl: parsed.toString() };
  } catch {
    return { isEmpty: false, isValid: false, normalizedUrl: trimmed };
  }
}

/**
 * Validates the user's certificate and links according to the rules:
 * 1. Certificate file (PDF or Image) is mandatory.
 * 2. At least one of the two links (Certificate Link or Verification Link) is mandatory.
 * 3. Any provided link must be a valid URL.
 */
export function validateSubmission(params: {
  hasCertificate: boolean;
  certificateLink: string;
  verificationLink: string;
  customCertHeading?: string;
  customVerifyHeading?: string;
}): ValidationResult {
  const {
    hasCertificate,
    certificateLink,
    verificationLink,
    customCertHeading = 'Certificate Link',
    customVerifyHeading = 'Verification Link',
  } = params;

  const certCheck = normalizeAndValidateUrl(certificateLink);
  const verifyCheck = normalizeAndValidateUrl(verificationLink);

  const certificateLinkError =
    !certCheck.isEmpty && !certCheck.isValid
      ? 'يرجى إدخال رابط شهادة صحيح (مثال: https://...)'
      : null;

  const verificationLinkError =
    !verifyCheck.isEmpty && !verifyCheck.isValid
      ? 'يرجى إدخال رابط توثيق صحيح (مثال: https://...)'
      : null;

  const activeLinks: LinkEntry[] = [];
  if (!certCheck.isEmpty && certCheck.isValid) {
    activeLinks.push({
      id: 'certificate',
      heading: customCertHeading.trim() || 'Certificate Link',
      arabicLabel: 'رابط الشهادة',
      url: certCheck.normalizedUrl,
    });
  }
  if (!verifyCheck.isEmpty && verifyCheck.isValid) {
    activeLinks.push({
      id: 'verification',
      heading: customVerifyHeading.trim() || 'Verification Link',
      arabicLabel: 'رابط توثيق إكمال الكورس',
      url: verifyCheck.normalizedUrl,
    });
  }

  const hasAtLeastOneLink = activeLinks.length > 0;
  let generalError: string | null = null;

  if (!hasCertificate && !hasAtLeastOneLink) {
    generalError = 'يرجى رفع ملف الشهادة وإدخال رابط واحد على الأقل (رابط الشهادة أو رابط التوثيق).';
  } else if (!hasCertificate) {
    generalError = 'رفع الشهادة إجباري (ملف PDF أو صورة).';
  } else if (certCheck.isEmpty && verifyCheck.isEmpty) {
    generalError = 'يجب إدخال رابط واحد على الأقل (رابط الشهادة أو رابط توثيق الكورس).';
  } else if (certificateLinkError || verificationLinkError) {
    generalError = 'يرجى تصحيح الروابط المدخلة قبل تحميل الملف.';
  }

  const isValid =
    hasCertificate &&
    hasAtLeastOneLink &&
    certificateLinkError === null &&
    verificationLinkError === null;

  return {
    isValid,
    hasCertificate,
    hasAtLeastOneLink,
    certificateLinkError,
    verificationLinkError,
    generalError,
    activeLinks,
  };
}

/**
 * Splits a long URL into clean, balanced lines (like the reference PDF where
 * long query strings wrap neatly onto a second centered line).
 */
export function wrapUrlForDisplay(url: string, maxCharsPerLine = 115): string[] {
  const clean = url.trim();
  if (clean.length <= maxCharsPerLine) {
    return [clean];
  }

  const lines: string[] = [];
  let remaining = clean;

  while (remaining.length > maxCharsPerLine) {
    const slice = remaining.slice(0, maxCharsPerLine);
    // Prefer splitting after a natural URL delimiter (?, &, _, -, /, =) near the end of the line
    let splitIdx = -1;
    const minSplit = Math.floor(maxCharsPerLine * 0.75);
    for (let i = slice.length - 1; i >= minSplit; i--) {
      const ch = slice[i];
      if (ch === '&' || ch === '?' || ch === '_' || ch === '-' || ch === '/' || ch === '=') {
        splitIdx = i + 1;
        break;
      }
    }
    if (splitIdx === -1) {
      splitIdx = maxCharsPerLine;
    }
    lines.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx);
  }

  if (remaining.length > 0) {
    lines.push(remaining);
  }

  return lines;
}

/**
 * Computes exact A4 portrait (210mm x 297mm) layout coordinates so that the
 * certificate at the top and the 1 or 2 link+QR blocks below it fit harmoniously
 * on a single page without clipping or overlapping, matching the reference PDF.
 */
export function calculatePdfLayout(params: {
  certAspectRatio: number; // width / height
  activeLinks: LinkEntry[];
}): PdfPageLayout {
  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const horizontalMarginMm = 14;
  const topMarginMm = 12;

  const safeAspectRatio =
    Number.isFinite(params.certAspectRatio) && params.certAspectRatio > 0.2
      ? params.certAspectRatio
      : 1.414; // Default landscape A4-like certificate ratio

  const blockCount = params.activeLinks.length;

  // Max width available for the certificate
  const maxCertWidthMm = pageWidthMm - horizontalMarginMm * 2; // 182mm
  // Reserve vertical space at bottom for 1 or 2 QR blocks
  const maxCertHeightMm = blockCount >= 2 ? 128 : 165;

  let certWidth = maxCertWidthMm;
  let certHeight = certWidth / safeAspectRatio;

  if (certHeight > maxCertHeightMm) {
    certHeight = maxCertHeightMm;
    certWidth = certHeight * safeAspectRatio;
  }

  const certX = (pageWidthMm - certWidth) / 2;
  const certY = topMarginMm;

  // QR code size and vertical spacing depending on 1 vs 2 links
  const qrSize = blockCount >= 2 ? 38 : 46;
  const sectionGapTop = blockCount >= 2 ? 11 : 18;
  const betweenBlocksGap = blockCount >= 2 ? 11 : 14;
  const urlLineHeight = 4.6;

  let currentY = certY + certHeight + sectionGapTop;
  const blocks: PdfLinkBlockLayout[] = [];

  for (const link of params.activeLinks) {
    const urlLines = wrapUrlForDisplay(link.url, 115);
    const headingY = currentY;
    const urlStartY = headingY + 6.5;
    const qrY = urlStartY + urlLines.length * urlLineHeight + 3.5;
    const qrX = (pageWidthMm - qrSize) / 2;

    blocks.push({
      id: link.id,
      heading: link.heading,
      url: link.url,
      urlLines,
      headingY,
      urlStartY,
      urlLineHeight,
      qrX,
      qrY,
      qrSize,
    });

    currentY = qrY + qrSize + betweenBlocksGap;
  }

  return {
    pageWidthMm,
    pageHeightMm,
    certX,
    certY,
    certWidth,
    certHeight,
    blocks,
  };
}
