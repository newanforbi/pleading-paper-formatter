'use strict';

// ============================================================
// PLEADING PAPER LAYOUT CONSTANTS  (points; 1 inch = 72 pts)
// Matches the Python/reportlab reference implementation exactly.
// ============================================================
const PP = {
  PAGE_W:          612,
  PAGE_H:          792,
  LINE_SPACING:    24,
  NUM_LINES:       28,
  FONT_SIZE:       12,
  VERT_LINE_LEFT:  72 + 21.6,       // 93.6  — left double-rule, outer
  VERT_LINE_RIGHT: 72 + 25.2,       // 97.2  — left double-rule, inner
  CONTENT_LEFT:    72 + 25.2 + 7.2, // 104.4 — text content starts here
  CONTENT_RIGHT:   612 - 36,        // 576   — right margin rule
  LINE_NUM_X:      72 + 21.6 - 5.76,// 87.84 — right-edge of line numbers
  TEXT_START_Y:    792 - 75.6,      // 716.4 — baseline of first line (from bottom)
};

PP.CONTENT_WIDTH  = PP.CONTENT_RIGHT - PP.CONTENT_LEFT;         // 471.6
PP.TEXT_END_Y     = PP.TEXT_START_Y - (PP.NUM_LINES - 1) * PP.LINE_SPACING; // 68.4
PP.FOOTER_RULE_Y  = PP.TEXT_END_Y - 12;  // 56.4
PP.FOOTER_PAGE_Y  = PP.FOOTER_RULE_Y - 16; // 40.4
PP.FOOTER_TITLE_Y = PP.FOOTER_PAGE_Y - 14; // 26.4

// Caption block column split at 55% of content width
PP.CAPTION_MID_X = PP.CONTENT_LEFT + PP.CONTENT_WIDTH * 0.55; // ~363.78
PP.BRACKET_X     = PP.CAPTION_MID_X - 10;  // ~353.78
PP.RIGHT_COL_X   = PP.CAPTION_MID_X + 5;   // ~368.78
PP.RIGHT_COL_W   = PP.CONTENT_RIGHT - PP.RIGHT_COL_X; // ~207

// ============================================================
// CERTIFICATE OF SERVICE LAYOUT CONSTANTS
// ============================================================
const CL = {
  PAGE_W:    612,
  PAGE_H:    792,
  MARGIN:    72,
  BODY_LEFT: 72,
  BODY_RIGHT:540,
  BODY_WIDTH:468,
  BODY_TOP:  720, // 792 - 72
  BODY_BOT:  72,
  FS_TITLE:  14,
  FS_BODY:   12,
  FS_SMALL:  10,
  LINE_H:    18,
};

// ============================================================
// APPLICATION STATE
// ============================================================
const STATE = {
  plaintiff:       '',
  address:         '',
  phone:           '',
  email:           '',
  petitionerLabel: 'Petitioner, In Propria Persona',
  courtName:       'SUPERIOR COURT OF THE STATE OF CALIFORNIA',
  county:          '',
  caseNumber:      '',
  respondents:     '',
  docType:         '',
  footerTitle:     '',
  pleadingBody:    '',
  serviceDate:     '',
  execDate:        '',
  execCity:        '',
  documentsServed: '',
  recipients:      '',
  signerName:      '',
  signerTitle:     'Plaintiff, In Pro Per',
};

const FIELD_MAP = [
  ['prof-plaintiff',        'plaintiff'],
  ['prof-address',          'address'],
  ['prof-phone',            'phone'],
  ['prof-email',            'email'],
  ['prof-petitioner-label', 'petitionerLabel'],
  // prof-court handled separately by initCourtField()
  ['prof-county',           'county'],
  ['prof-case-number',      'caseNumber'],
  ['prof-respondents',      'respondents'],
  ['prof-doc-type',         'docType'],
  ['prof-footer-title',     'footerTitle'],
  ['pleading-body',         'pleadingBody'],
  ['cert-service-date',     'serviceDate'],
  ['cert-exec-date',        'execDate'],
  ['cert-exec-city',        'execCity'],
  ['cert-documents',        'documentsServed'],
  ['cert-recipients',       'recipients'],
  ['cert-signer-name',      'signerName'],
  ['cert-signer-title',     'signerTitle'],
];

// ============================================================
// FIELD BINDING
// ============================================================
function bindFields() {
  FIELD_MAP.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    STATE[key] = el.value;
    el.addEventListener('input', () => { STATE[key] = el.value; });
  });
}

// ============================================================
// COURT FIELD BINDING (select + optional custom input)
// ============================================================
function initCourtField() {
  const sel = document.getElementById('prof-court');
  const custom = document.getElementById('prof-court-custom');
  function syncCourt() {
    if (sel.value === '__custom__') {
      custom.style.display = '';
      STATE.courtName = custom.value;
    } else {
      custom.style.display = 'none';
      STATE.courtName = sel.value;
    }
  }
  sel.addEventListener('change', syncCourt);
  custom.addEventListener('input', () => { STATE.courtName = custom.value; });
  syncCourt();
}

// ============================================================
// TAB SWITCHING
// ============================================================
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('tab-active'));
      btn.classList.add('active');
      const pane = document.getElementById('tab-' + btn.dataset.tab);
      if (pane) pane.classList.add('tab-active');
    });
  });
}

// ============================================================
// TEXT SANITIZER  (pdf-lib standard fonts use WinAnsi/Latin-1)
// ============================================================
function sanitize(text) {
  if (!text) return '';
  return text
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x00-\xFF]/g, '?');
}

// ============================================================
// AUTO-FORMAT ENGINE
// ============================================================
function detectLineType(line) {
  const t = line.trim();
  if (!t) return 'BLANK';

  // Numbered or bulleted list item
  if (/^(\d+[\.\)]\s+|\([a-zA-Z0-9]+\)\s+|[•\-\*]\s+)/.test(t)) {
    return 'LIST_ITEM';
  }

  // ALL CAPS: significant alpha words (>2 chars) all uppercase
  const words = t.split(/\s+/);
  const sig = words.filter(w => w.replace(/[^A-Za-z]/g, '').length > 2);
  if (sig.length > 0 && sig.every(w => {
    const a = w.replace(/[^A-Za-z]/g, '');
    return a.length === 0 || a === a.toUpperCase();
  })) {
    return 'HEADER';
  }

  return 'PARA';
}

function parseBodyText(raw) {
  if (!raw || !raw.trim()) return [];
  const lines = raw.split('\n');
  const blocks = [];
  let paraLines = [];

  for (const line of lines) {
    const type = detectLineType(line);

    if (type === 'BLANK') {
      if (paraLines.length) {
        blocks.push({ type: 'PARA', text: paraLines.join(' ') });
        paraLines = [];
      }
      continue;
    }

    if (type === 'HEADER' || type === 'LIST_ITEM') {
      if (paraLines.length) {
        blocks.push({ type: 'PARA', text: paraLines.join(' ') });
        paraLines = [];
      }
      blocks.push({ type, text: line.trim() });
      continue;
    }

    // PARA: accumulate consecutive lines
    paraLines.push(line.trim());
  }

  if (paraLines.length) blocks.push({ type: 'PARA', text: paraLines.join(' ') });
  return blocks;
}

// ============================================================
// TEXT WRAP
// ============================================================
function wrapText(text, font, size, maxWidth) {
  const clean = sanitize(text);
  if (!clean.trim()) return [''];
  const words = clean.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';

  for (const word of words) {
    const candidate = cur ? cur + ' ' + word : word;
    let w;
    try { w = font.widthOfTextAtSize(candidate, size); }
    catch (e) { w = candidate.length * size * 0.55; }

    if (w > maxWidth && cur !== '') {
      lines.push(cur);
      cur = word;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [''];
}

// ============================================================
// LINE DESCRIPTOR CONSTRUCTORS
// ============================================================
function tl(text, font, size, x) {
  return { type: 'text', text: sanitize(text), font, size, x };
}

function cl(text, font, size) {
  let w;
  try { w = font.widthOfTextAtSize(sanitize(text), size); }
  catch (e) { w = text.length * size * 0.55; }
  const x = PP.CONTENT_LEFT + (PP.CONTENT_WIDTH - w) / 2;
  return { type: 'text', text: sanitize(text), font, size, x };
}

function bl() { return { type: 'blank' }; }
function rl() { return { type: 'rule' }; }

function captionRow(leftText, leftBold, rightText, rightBold) {
  return {
    type: 'caption_row',
    left:  { text: sanitize(leftText),  bold: leftBold },
    right: { text: sanitize(rightText), bold: rightBold },
  };
}

// ============================================================
// CAPTION BLOCK  (first-page header)
// ============================================================
function buildCaptionLines(state, fonts) {
  const lines = [];

  // Top-left: filer info
  if (state.plaintiff)       lines.push(tl(state.plaintiff,       fonts.r, PP.FONT_SIZE, PP.CONTENT_LEFT));
  if (state.address) {
    for (const addrLine of state.address.split('\n').map(l => l.trim()).filter(Boolean)) {
      lines.push(tl(addrLine, fonts.r, PP.FONT_SIZE, PP.CONTENT_LEFT));
    }
  }
  if (state.phone)           lines.push(tl(state.phone,           fonts.r, PP.FONT_SIZE, PP.CONTENT_LEFT));
  if (state.email)           lines.push(tl(state.email,           fonts.r, PP.FONT_SIZE, PP.CONTENT_LEFT));
  if (state.petitionerLabel) lines.push(tl(state.petitionerLabel, fonts.r, PP.FONT_SIZE, PP.CONTENT_LEFT));
  lines.push(bl());

  // Court name (centered, bold)
  if (state.courtName) lines.push(cl(state.courtName.toUpperCase(), fonts.b, PP.FONT_SIZE));
  if (state.county)    lines.push(cl('COUNTY OF ' + state.county.toUpperCase(), fonts.b, PP.FONT_SIZE));
  lines.push(bl());

  // Two-column caption
  const leftCol  = buildLeftColumn(state);
  const rightCol = buildRightColumn(state, fonts);
  const maxRows  = Math.max(leftCol.length, rightCol.length);
  for (let i = 0; i < maxRows; i++) {
    const L = leftCol[i]  || { text: '', bold: false };
    const R = rightCol[i] || { text: '', bold: false };
    lines.push(captionRow(L.text, L.bold, R.text, R.bold));
  }

  lines.push(rl());
  lines.push(bl());

  return lines;
}

function buildLeftColumn(state) {
  const rows = [];
  rows.push({ text: 'In re:', bold: false });
  if (state.plaintiff)  rows.push({ text: state.plaintiff + ',',           bold: false });
  if (state.address) {
    for (const addrLine of state.address.split('\n').map(l => l.trim()).filter(Boolean)) {
      rows.push({ text: addrLine, bold: false });
    }
  }
  rows.push({ text: '               Petitioner,', bold: false });

  const respLines = state.respondents
    ? state.respondents.split('\n').map(l => l.trim()).filter(Boolean)
    : [];

  if (respLines.length) {
    rows.push({ text: '', bold: false });
    rows.push({ text: ' v.', bold: false });
    for (const rl of respLines) rows.push({ text: rl + ',', bold: false });
    rows.push({ text: '               Respondents.', bold: false });
  }

  return rows;
}

function buildRightColumn(state, fonts) {
  const rows = [];
  rows.push({ text: 'Case No. ' + (state.caseNumber || '______________'), bold: false });
  rows.push({ text: '', bold: false });

  const source = (state.docType || state.footerTitle || '').trim();
  if (source) {
    for (const line of source.split('\n')) {
      const t = line.trim();
      if (!t) { rows.push({ text: '', bold: false }); continue; }
      // Wrap to right-column width
      const wrapped = wrapText(t, fonts.b, PP.FONT_SIZE, PP.RIGHT_COL_W);
      for (const w of wrapped) rows.push({ text: w, bold: true });
    }
  }

  return rows;
}

// ============================================================
// BODY CONTENT → RENDERED LINES
// ============================================================
function buildBodyLines(blocks, fonts) {
  const lines = [];
  const INDENT = 36;

  for (const block of blocks) {
    switch (block.type) {

      case 'BLANK':
        lines.push(bl());
        break;

      case 'HEADER': {
        lines.push(bl());
        const ws = wrapText(block.text, fonts.b, PP.FONT_SIZE, PP.CONTENT_WIDTH);
        for (const w of ws) lines.push(cl(w, fonts.b, PP.FONT_SIZE));
        lines.push(bl());
        break;
      }

      case 'PARA': {
        // First wrapped line gets +36pt indent; subsequent lines flush left
        const clean = sanitize(block.text);
        const words = clean.split(/\s+/).filter(Boolean);
        let cur = '';
        let isFirst = true;
        let maxW = PP.CONTENT_WIDTH - INDENT; // first line narrower
        const rendered = [];

        for (const word of words) {
          const candidate = cur ? cur + ' ' + word : word;
          let w;
          try { w = fonts.r.widthOfTextAtSize(candidate, PP.FONT_SIZE); }
          catch (e) { w = candidate.length * 6.6; }

          if (w > maxW && cur !== '') {
            rendered.push({ text: cur, indent: isFirst ? INDENT : 0 });
            cur = word;
            if (isFirst) { isFirst = false; maxW = PP.CONTENT_WIDTH; }
          } else {
            cur = candidate;
          }
        }
        if (cur) rendered.push({ text: cur, indent: isFirst ? INDENT : 0 });

        for (const r of rendered) {
          lines.push(tl(r.text, fonts.r, PP.FONT_SIZE, PP.CONTENT_LEFT + r.indent));
        }
        lines.push(bl());
        break;
      }

      case 'LIST_ITEM': {
        const ws = wrapText(block.text, fonts.r, PP.FONT_SIZE, PP.CONTENT_WIDTH - INDENT);
        for (const w of ws) lines.push(tl(w, fonts.r, PP.FONT_SIZE, PP.CONTENT_LEFT + INDENT));
        lines.push(bl());
        break;
      }
    }
  }

  return lines;
}

// ============================================================
// PAGE FRAME  (vertical rules + line numbers + footer)
// ============================================================
function drawPageFrame(page, pageNum, footerTitle, fonts) {
  const BLACK = PDFLib.rgb(0, 0, 0);
  const lo = { thickness: 0.5, color: BLACK };

  // Three vertical rules
  page.drawLine({ start: { x: PP.VERT_LINE_LEFT,  y: 0 }, end: { x: PP.VERT_LINE_LEFT,  y: PP.PAGE_H }, ...lo });
  page.drawLine({ start: { x: PP.VERT_LINE_RIGHT, y: 0 }, end: { x: PP.VERT_LINE_RIGHT, y: PP.PAGE_H }, ...lo });
  page.drawLine({ start: { x: PP.CONTENT_RIGHT,   y: 0 }, end: { x: PP.CONTENT_RIGHT,   y: PP.PAGE_H }, ...lo });

  // Line numbers 1–28
  for (let i = 0; i < PP.NUM_LINES; i++) {
    const numStr = String(i + 1);
    let nw;
    try { nw = fonts.h.widthOfTextAtSize(numStr, 10); }
    catch (e) { nw = numStr.length * 6; }
    page.drawText(numStr, {
      x: PP.LINE_NUM_X - nw,
      y: PP.TEXT_START_Y - i * PP.LINE_SPACING,
      size: 10,
      font: fonts.h,
      color: BLACK,
    });
  }

  // Footer horizontal rule
  page.drawLine({
    start: { x: PP.VERT_LINE_RIGHT, y: PP.FOOTER_RULE_Y },
    end:   { x: PP.CONTENT_RIGHT,   y: PP.FOOTER_RULE_Y },
    thickness: 0.5, color: BLACK,
  });

  // Footer: "Page N"
  const centerX = (PP.VERT_LINE_LEFT + PP.CONTENT_RIGHT) / 2;
  const pageStr = 'Page ' + pageNum;
  let pw;
  try { pw = fonts.h.widthOfTextAtSize(pageStr, 10); }
  catch (e) { pw = pageStr.length * 6; }
  page.drawText(pageStr, {
    x: centerX - pw / 2,
    y: PP.FOOTER_PAGE_Y,
    size: 10, font: fonts.h, color: BLACK,
  });

  // Footer: document title (truncate to fit)
  if (footerTitle) {
    const maxW = PP.CONTENT_RIGHT - PP.VERT_LINE_RIGHT - 20;
    let ft = sanitize(footerTitle);
    try {
      while (ft.length > 3 && fonts.h.widthOfTextAtSize(ft, 9) > maxW) {
        ft = ft.slice(0, -1);
      }
      if (ft !== sanitize(footerTitle)) ft += '...';
      const ftw = fonts.h.widthOfTextAtSize(ft, 9);
      page.drawText(ft, {
        x: centerX - ftw / 2,
        y: PP.FOOTER_TITLE_Y,
        size: 9, font: fonts.h, color: BLACK,
      });
    } catch (e) { /* skip footer title on error */ }
  }
}

// ============================================================
// DRAW ONE LINE AT Y
// ============================================================
function drawLineAt(page, line, y, fonts) {
  const BLACK = PDFLib.rgb(0, 0, 0);

  if (line.type === 'blank') return;

  if (line.type === 'rule') {
    page.drawLine({
      start: { x: PP.CONTENT_LEFT,  y },
      end:   { x: PP.CONTENT_RIGHT, y },
      thickness: 1.0, color: BLACK,
    });
    return;
  }

  if (line.type === 'caption_row') {
    if (line.left.text) {
      const lf = line.left.bold ? fonts.b : fonts.r;
      page.drawText(line.left.text, { x: PP.CONTENT_LEFT, y, size: PP.FONT_SIZE, font: lf, color: BLACK });
      page.drawText(')', { x: PP.BRACKET_X, y, size: PP.FONT_SIZE, font: fonts.r, color: BLACK });
    }
    if (line.right.text) {
      const rf = line.right.bold ? fonts.b : fonts.r;
      page.drawText(line.right.text, { x: PP.RIGHT_COL_X, y, size: PP.FONT_SIZE, font: rf, color: BLACK });
    }
    return;
  }

  if (line.type === 'text' && line.text) {
    try {
      page.drawText(line.text, {
        x: line.x, y,
        size: line.size,
        font: line.font,
        color: BLACK,
      });
    } catch (e) {
      // Fallback: draw as Helvetica if font chokes on a character
      try {
        page.drawText(line.text, { x: line.x, y, size: line.size, font: fonts.h, color: BLACK });
      } catch (_) {}
    }
  }
}

// ============================================================
// BUILD PLEADING PAPER PDF
// ============================================================
async function buildPleadingPDF(state) {
  const { PDFDocument, StandardFonts } = PDFLib;
  const doc = await PDFDocument.create();

  const fonts = {
    r: await doc.embedFont(StandardFonts.TimesRoman),
    b: await doc.embedFont(StandardFonts.TimesRomanBold),
    h: await doc.embedFont(StandardFonts.Helvetica),
  };

  // Build flat line array: caption + body
  const captionLines = buildCaptionLines(state, fonts);
  const blocks       = parseBodyText(state.pleadingBody);
  const bodyLines    = buildBodyLines(blocks, fonts);
  const allLines     = [...captionLines, ...bodyLines];

  // Paginate into chunks of NUM_LINES
  const pages = [];
  for (let i = 0; i < allLines.length; i += PP.NUM_LINES) {
    pages.push(allLines.slice(i, i + PP.NUM_LINES));
  }
  if (pages.length === 0) pages.push([]);

  // Render each page
  for (let pi = 0; pi < pages.length; pi++) {
    const page     = doc.addPage([PP.PAGE_W, PP.PAGE_H]);
    const pageLines = pages[pi];

    drawPageFrame(page, pi + 1, state.footerTitle, fonts);

    for (let li = 0; li < pageLines.length; li++) {
      const y = PP.TEXT_START_Y - li * PP.LINE_SPACING;
      drawLineAt(page, pageLines[li], y, fonts);
    }
  }

  return doc.save();
}

// ============================================================
// BUILD CERTIFICATE OF SERVICE PDF
// ============================================================
async function buildCertificatePDF(state) {
  const { PDFDocument, StandardFonts } = PDFLib;
  const doc  = await PDFDocument.create();
  const fR   = await doc.embedFont(StandardFonts.TimesRoman);
  const fB   = await doc.embedFont(StandardFonts.TimesRomanBold);
  const BLACK = PDFLib.rgb(0, 0, 0);

  const { BODY_LEFT: BL, BODY_RIGHT: BR, BODY_WIDTH: BW,
          BODY_TOP, BODY_BOT, LINE_H, FS_TITLE, FS_BODY, FS_SMALL } = CL;

  let page = doc.addPage([CL.PAGE_W, CL.PAGE_H]);
  let y    = BODY_TOP;

  function ensureSpace(needed) {
    if (y < BODY_BOT + needed * LINE_H) {
      page = doc.addPage([CL.PAGE_W, CL.PAGE_H]);
      y = BODY_TOP;
    }
  }

  function drawLeft(text, font, size) {
    ensureSpace(1);
    const s = sanitize(text);
    if (s) page.drawText(s, { x: BL, y, font, size, color: BLACK });
    y -= LINE_H;
  }

  function drawCentered(text, font, size) {
    ensureSpace(1);
    const s = sanitize(text);
    if (s) {
      let w;
      try { w = font.widthOfTextAtSize(s, size); } catch (e) { w = s.length * size * 0.55; }
      page.drawText(s, { x: BL + (BW - w) / 2, y, font, size, color: BLACK });
    }
    y -= LINE_H;
  }

  function drawWrapped(text, font, size, indent) {
    const lines = wrapText(text, font, size, BW - (indent || 0));
    for (const line of lines) {
      ensureSpace(1);
      if (line) page.drawText(line, { x: BL + (indent || 0), y, font, size, color: BLACK });
      y -= LINE_H;
    }
  }

  function skip(n) { y -= LINE_H * (n || 1); }

  // ── TITLE ────────────────────────────────────────────────
  drawCentered('CERTIFICATE OF SERVICE', fB, FS_TITLE);
  skip(2);

  // ── TWO-COLUMN CASE HEADER ───────────────────────────────
  const HALF  = BW / 2;
  const PAD   = 14;
  const LEFT_LABEL  = 'Case Name:';
  const RIGHT_LABEL = 'No.';
  let llw, rlw;
  try { llw = fB.widthOfTextAtSize(LEFT_LABEL,  FS_BODY); } catch (e) { llw = 70; }
  try { rlw = fB.widthOfTextAtSize(RIGHT_LABEL, FS_BODY); } catch (e) { rlw = 20; }

  const leftValX  = BL + llw + 6;
  const rightColX = BL + HALF + PAD;
  const rightValX = rightColX + rlw + 6;

  ensureSpace(5);
  const headerY = y;

  // Labels
  page.drawText(LEFT_LABEL,  { x: BL,        y: headerY, font: fB, size: FS_BODY, color: BLACK });
  page.drawText(RIGHT_LABEL, { x: rightColX, y: headerY, font: fB, size: FS_BODY, color: BLACK });

  // Underlines under value areas
  page.drawLine({ start: { x: leftValX,  y: headerY - 2 }, end: { x: BL + HALF - PAD, y: headerY - 2 }, thickness: 0.5, color: BLACK });
  page.drawLine({ start: { x: rightValX, y: headerY - 2 }, end: { x: BR,              y: headerY - 2 }, thickness: 0.5, color: BLACK });

  // Case number on right
  const caseNo = sanitize(state.caseNumber || '_______________');
  page.drawText(caseNo, { x: rightValX, y: headerY, font: fR, size: FS_BODY, color: BLACK });

  // Case name on left (wrapped within column)
  const caseName     = sanitize(state.plaintiff || '');
  const leftColWidth = BL + HALF - PAD - leftValX;
  const caseNameLines = wrapText(caseName, fR, FS_BODY, leftColWidth);
  for (let i = 0; i < caseNameLines.length; i++) {
    const lineY = headerY - i * LINE_H;
    if (caseNameLines[i]) page.drawText(caseNameLines[i], { x: leftValX, y: lineY, font: fR, size: FS_BODY, color: BLACK });
  }

  y = headerY - Math.max(caseNameLines.length, 1) * LINE_H;
  skip(1);

  // ── COURT LINE ───────────────────────────────────────────
  let courtLine = '';
  if (state.courtName) courtLine = state.courtName;
  if (state.county) courtLine += (courtLine ? ', County of ' : 'County of ') + state.county;
  if (courtLine) {
    drawLeft(courtLine, fR, FS_SMALL);
    skip(1);
  }

  // ── SERVICE STATEMENT ────────────────────────────────────
  const svcDate = sanitize(state.serviceDate || '_______________');
  drawWrapped(`I hereby certify that on ${svcDate}, I served the following document(s):`, fR, FS_BODY, 0);
  skip(1);

  // ── DOCUMENTS SERVED ────────────────────────────────────
  const docs = (state.documentsServed || '').split('\n').map(s => s.trim()).filter(Boolean);
  for (const doc_ of docs) drawLeft(doc_, fB, FS_BODY);
  skip(1);

  // ── US MAIL STATEMENT ────────────────────────────────────
  drawWrapped(
    'I caused a true and correct copy of the foregoing document(s) to be served by placing it in a sealed envelope with postage fully prepaid, deposited in the United States mail, addressed as follows:',
    fR, FS_BODY, 0
  );
  skip(1);

  // ── RECIPIENTS ──────────────────────────────────────────
  const recBlocks = (state.recipients || '').split(/\n\s*\n/).filter(b => b.trim());
  for (const block of recBlocks) {
    for (const line of block.split('\n').map(l => l.trim()).filter(Boolean)) {
      drawLeft(line, fR, FS_BODY);
    }
    skip(1);
  }

  // ── PERJURY DECLARATION ──────────────────────────────────
  const execDate = sanitize(state.execDate || '_______________');
  const execCity = sanitize(state.execCity || '_______________');
  drawWrapped(
    `I declare under penalty of perjury under the laws of the United States of America that the foregoing is true and correct and that this declaration was executed on ${execDate}, at ${execCity}.`,
    fR, FS_BODY, 0
  );
  skip(2);

  // ── SIGNATURE BLOCK ──────────────────────────────────────
  ensureSpace(5);
  const SIG_W   = 230;
  const rightSX = BL + BW / 2 + PAD;

  // Underlines
  page.drawLine({ start: { x: BL,       y }, end: { x: BL + SIG_W,       y }, thickness: 0.6, color: BLACK });
  page.drawLine({ start: { x: rightSX,  y }, end: { x: rightSX + SIG_W,  y }, thickness: 0.6, color: BLACK });
  y -= LINE_H;

  // Printed name and "Signature" label
  const sigName  = sanitize(state.signerName || state.plaintiff || '');
  const sigTitle = sanitize(state.signerTitle || '');
  if (sigName)  page.drawText(sigName,  { x: BL,      y, font: fR, size: FS_SMALL, color: BLACK });
  page.drawText('Signature', { x: rightSX, y, font: fR, size: FS_SMALL, color: BLACK });
  y -= LINE_H;

  if (sigTitle) page.drawText(sigTitle, { x: BL, y, font: fR, size: FS_SMALL, color: BLACK });

  return doc.save();
}

// ============================================================
// DOWNLOAD HELPER
// ============================================================
function downloadPDF(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

// ============================================================
// BUTTON HANDLERS
// ============================================================
function initButtons() {
  async function generate(btnId, statusId, buildFn, filenameFn) {
    const btn    = document.getElementById(btnId);
    const status = document.getElementById(statusId);
    btn.disabled = true;
    status.textContent = 'Generating...';
    status.className   = 'status-msg';
    try {
      const bytes = await buildFn(STATE);
      downloadPDF(bytes, filenameFn(STATE));
      status.textContent = 'PDF downloaded.';
      status.className   = 'status-msg success';
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
      status.className   = 'status-msg error';
      console.error(err);
    } finally {
      btn.disabled = false;
    }
  }

  document.getElementById('btn-generate-pleading').addEventListener('click', () =>
    generate(
      'btn-generate-pleading', 'pleading-status',
      buildPleadingPDF,
      s => 'Pleading_Paper_' + (s.plaintiff || 'Document').replace(/\s+/g, '_') + '.pdf'
    )
  );

  document.getElementById('btn-generate-cert').addEventListener('click', () =>
    generate(
      'btn-generate-cert', 'cert-status',
      buildCertificatePDF,
      s => 'Certificate_of_Service_' + (s.plaintiff || 'Document').replace(/\s+/g, '_') + '.pdf'
    )
  );
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  if (typeof PDFLib === 'undefined') {
    document.querySelectorAll('.btn-primary').forEach(b => { b.disabled = true; });
    console.error('pdf-lib failed to load. Check your internet connection.');
    return;
  }
  initTabs();
  bindFields();
  initCourtField();
  initButtons();
});
