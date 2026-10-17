import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAndValidateUrl,
  validateSubmission,
  wrapUrlForDisplay,
  calculatePdfLayout,
} from './documentLogic.ts';

test('normalizeAndValidateUrl validates and normalizes URLs properly', () => {
  assert.deepEqual(normalizeAndValidateUrl(''), {
    isEmpty: true,
    isValid: false,
    normalizedUrl: '',
  });

  const validHttps = normalizeAndValidateUrl(
    'https://www.datacamp.com/statement-of-accomplishment/track/089119a2e34cf4b9b94252c489892fcc2cbfdfba?raw=1'
  );
  assert.equal(validHttps.isEmpty, false);
  assert.equal(validHttps.isValid, true);

  const withoutProtocol = normalizeAndValidateUrl('datacamp.com/completed/track/123');
  assert.equal(withoutProtocol.isValid, true);
  assert.equal(withoutProtocol.normalizedUrl, 'https://datacamp.com/completed/track/123');

  const invalid = normalizeAndValidateUrl('not a valid url');
  assert.equal(invalid.isValid, false);
});

test('validateSubmission enforces mandatory certificate and at least one link', () => {
  // Missing certificate and links
  const emptyResult = validateSubmission({
    hasCertificate: false,
    certificateLink: '',
    verificationLink: '',
  });
  assert.equal(emptyResult.isValid, false);
  assert.equal(emptyResult.activeLinks.length, 0);

  // Has certificate, no links -> invalid
  const certOnly = validateSubmission({
    hasCertificate: true,
    certificateLink: '',
    verificationLink: '',
  });
  assert.equal(certOnly.isValid, false);

  // Has certificate + 1 link (Certificate Link only) -> valid (2 elements submitted)
  const certAndOneLink = validateSubmission({
    hasCertificate: true,
    certificateLink: 'https://www.datacamp.com/statement-of-accomplishment/track/089119',
    verificationLink: '',
  });
  assert.equal(certAndOneLink.isValid, true);
  assert.equal(certAndOneLink.activeLinks.length, 1);
  assert.equal(certAndOneLink.activeLinks[0].id, 'certificate');

  // Has certificate + 1 link (Verification Link only) -> valid (2 elements submitted)
  const certAndVerifyOnly = validateSubmission({
    hasCertificate: true,
    certificateLink: '',
    verificationLink: 'https://www.datacamp.com/completed/statement-of-accomplishment/track/089119',
  });
  assert.equal(certAndVerifyOnly.isValid, true);
  assert.equal(certAndVerifyOnly.activeLinks.length, 1);
  assert.equal(certAndVerifyOnly.activeLinks[0].id, 'verification');

  // Has certificate + both links -> valid (all 3 elements submitted)
  const allThree = validateSubmission({
    hasCertificate: true,
    certificateLink: 'https://www.datacamp.com/statement-of-accomplishment/track/089119?raw=1',
    verificationLink:
      'https://www.datacamp.com/completed/statement-of-accomplishment/track/089119?utm_medium=organic_social',
  });
  assert.equal(allThree.isValid, true);
  assert.equal(allThree.activeLinks.length, 2);
  assert.equal(allThree.activeLinks[0].heading, 'Certificate Link');
  assert.equal(allThree.activeLinks[1].heading, 'Verification Link');
});

test('wrapUrlForDisplay wraps long URLs cleanly at delimiters matching reference PDF', () => {
  const certUrl =
    'https://www.datacamp.com/statement-of-accomplishment/track/089119a2e34cf4b9b94252c489892fcc2cbfdfba?raw=1';
  assert.equal(wrapUrlForDisplay(certUrl, 115).length, 1);

  const longUrl =
    'https://www.datacamp.com/completed/statement-of-accomplishment/track/089119a2e34cf4b9b94252c489892fcc2cbfdfba?utm_medium=organic_social&utm_campaign=sharewidget&utm_content=soa';
  const lines = wrapUrlForDisplay(longUrl, 115);
  assert.equal(lines.length, 2);
  assert.equal(lines.join(''), longUrl);
  assert.ok(lines[0].endsWith('utm_'));
});

test('calculatePdfLayout fits certificate and 2 QR blocks inside 210x297mm A4 portrait bounds', () => {
  const validation = validateSubmission({
    hasCertificate: true,
    certificateLink:
      'https://www.datacamp.com/statement-of-accomplishment/track/089119a2e34cf4b9b94252c489892fcc2cbfdfba?raw=1',
    verificationLink:
      'https://www.datacamp.com/completed/statement-of-accomplishment/track/089119a2e34cf4b9b94252c489892fcc2cbfdfba?utm_medium=organic_social&utm_campaign=sharewidget&utm_content=soa',
  });

  const layout = calculatePdfLayout({
    certAspectRatio: 1.42,
    activeLinks: validation.activeLinks,
  });

  assert.equal(layout.blocks.length, 2);
  const lastBlock = layout.blocks[1];
  const bottomEdge = lastBlock.qrY + lastBlock.qrSize;
  assert.ok(
    bottomEdge < layout.pageHeightMm - 8,
    `Expected bottom edge (${bottomEdge}mm) to fit comfortably within A4 height (${layout.pageHeightMm}mm)`
  );
});
