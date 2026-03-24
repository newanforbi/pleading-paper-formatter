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
  // Proof of Service fields
  posServiceDate:  '',
  posExecDate:     '',
  posExecCity:     '',
  posDocuments:    '',
  posRecipients:   '',
  posSignerName:   '',
  posSignerTitle:  'Plaintiff, In Pro Per',
  // Declaration fields
  declDocType:     '',
  declBody:        '',
  declExecDate:    '',
  declExecCity:    '',
  declSignerName:  '',
  declSignerTitle: 'Declarant',
  // Proposed Order fields
  orderDocType:    '',
  orderBody:       '',
  orderJudgeName:  '',
  orderJudgeTitle: 'Judge of the Superior Court',
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
  ['pos-service-date',      'posServiceDate'],
  ['pos-exec-date',         'posExecDate'],
  ['pos-exec-city',         'posExecCity'],
  ['pos-documents',         'posDocuments'],
  ['pos-recipients',        'posRecipients'],
  ['pos-signer-name',       'posSignerName'],
  ['pos-signer-title',      'posSignerTitle'],
  // Declaration
  ['decl-doc-type',         'declDocType'],
  ['decl-body',             'declBody'],
  ['decl-exec-date',        'declExecDate'],
  ['decl-exec-city',        'declExecCity'],
  ['decl-signer-name',      'declSignerName'],
  ['decl-signer-title',     'declSignerTitle'],
  // Proposed Order
  ['order-doc-type',        'orderDocType'],
  ['order-body',            'orderBody'],
  ['order-judge-name',      'orderJudgeName'],
  ['order-judge-title',     'orderJudgeTitle'],
];

// ============================================================
// LOCAL STORAGE PERSISTENCE
// ============================================================
const LS_KEY = 'pleading_state_v1';

function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(STATE)); } catch (e) {}
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (saved) Object.assign(STATE, saved);
  } catch (e) {}
}

function clearState() {
  try { localStorage.removeItem(LS_KEY); } catch (e) {}
  location.reload();
}

// ============================================================
// DATE HELPER
// ============================================================
function todayLong() {
  const d = new Date();
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ============================================================
// VALIDATION
// ============================================================
function validateState(state) {
  const errors = [];
  if (!state.plaintiff.trim())  errors.push('Plaintiff / Petitioner name is required.');
  if (!state.courtName.trim())  errors.push('Court name is required.');
  if (!state.caseNumber.trim()) errors.push('Case number is required.');
  return errors;
}

// ============================================================
// FIELD BINDING
// ============================================================
function bindFields() {
  loadState();
  FIELD_MAP.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = STATE[key];                              // restore from STATE (loaded from storage)
    el.addEventListener('input', () => { STATE[key] = el.value; saveState(); });
  });
}

// ============================================================
// COURT FIELD BINDING (select + optional custom input)
// ============================================================
function initCourtField() {
  const sel = document.getElementById('prof-court');
  const custom = document.getElementById('prof-court-custom');

  // Restore saved court name to select/custom input
  const saved = STATE.courtName;
  const knownValues = Array.from(sel.options).map(o => o.value);
  if (saved && !knownValues.includes(saved)) {
    sel.value = '__custom__';
    custom.value = saved;
  } else if (saved) {
    sel.value = saved;
  }

  function syncCourt() {
    if (sel.value === '__custom__') {
      custom.style.display = '';
      STATE.courtName = custom.value;
    } else {
      custom.style.display = 'none';
      STATE.courtName = sel.value;
    }
    saveState();
  }
  sel.addEventListener('change', syncCourt);
  custom.addEventListener('input', () => { STATE.courtName = custom.value; saveState(); });
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
// BUILD DECLARATION PDF  (pleading paper format)
// ============================================================
async function buildDeclarationPDF(state) {
  const { PDFDocument, StandardFonts } = PDFLib;
  const doc = await PDFDocument.create();

  const fonts = {
    r: await doc.embedFont(StandardFonts.TimesRoman),
    b: await doc.embedFont(StandardFonts.TimesRomanBold),
    i: await doc.embedFont(StandardFonts.TimesRomanItalic),
    h: await doc.embedFont(StandardFonts.Helvetica),
  };

  // Caption uses declDocType as the right-column title
  const captionState = { ...state, docType: state.declDocType };
  const captionLines = buildCaptionLines(captionState, fonts);

  const signerName  = sanitize(state.declSignerName  || state.plaintiff || '');
  const signerTitle = sanitize(state.declSignerTitle || 'Declarant');
  const execDate    = sanitize(state.declExecDate    || '_______________');
  const execCity    = sanitize(state.declExecCity    || '_______________');

  const allBlocks = [
    { type: 'PARA',  text: `I, ${signerName}, declare:` },
    ...parseBodyText(state.declBody),
    { type: 'BLANK' },
    { type: 'PARA',  text: 'I declare under penalty of perjury under the laws of the State of California that the foregoing is true and correct.' },
    { type: 'BLANK' },
    { type: 'PARA',  text: `Executed on ${execDate}, at ${execCity}.` },
    { type: 'BLANK' },
    { type: 'BLANK' },
    { type: 'PARA',  text: '______________________________' },
    { type: 'PARA',  text: signerName },
    { type: 'PARA',  text: signerTitle },
  ];

  const allLines = [...captionLines, ...buildBodyLines(allBlocks, fonts)];

  const pages = [];
  for (let i = 0; i < allLines.length; i += PP.NUM_LINES) {
    pages.push(allLines.slice(i, i + PP.NUM_LINES));
  }
  if (pages.length === 0) pages.push([]);

  const footerTitle = sanitize(state.footerTitle || 'DECLARATION');
  for (let pi = 0; pi < pages.length; pi++) {
    const page      = doc.addPage([PP.PAGE_W, PP.PAGE_H]);
    const pageLines = pages[pi];
    drawPageFrame(page, pi + 1, footerTitle, fonts);
    for (let li = 0; li < pageLines.length; li++) {
      const y = PP.TEXT_START_Y - li * PP.LINE_SPACING;
      drawLineAt(page, pageLines[li], y, fonts);
    }
  }

  return doc.save();
}

// ============================================================
// BUILD PROPOSED ORDER PDF  (pleading paper format)
// ============================================================
async function buildProposedOrderPDF(state) {
  const { PDFDocument, StandardFonts } = PDFLib;
  const doc = await PDFDocument.create();

  const fonts = {
    r: await doc.embedFont(StandardFonts.TimesRoman),
    b: await doc.embedFont(StandardFonts.TimesRomanBold),
    h: await doc.embedFont(StandardFonts.Helvetica),
  };

  const captionState = { ...state, docType: state.orderDocType };
  const captionLines = buildCaptionLines(captionState, fonts);

  const judgeName  = sanitize(state.orderJudgeName  || '');
  const judgeTitle = sanitize(state.orderJudgeTitle || 'Judge of the Superior Court');

  const allBlocks = [
    ...parseBodyText(state.orderBody),
    { type: 'BLANK' },
    { type: 'BLANK' },
    { type: 'PARA',  text: 'IT IS SO ORDERED.' },
    { type: 'BLANK' },
    { type: 'BLANK' },
    { type: 'BLANK' },
    { type: 'PARA',  text: 'Dated: _______________________' },
    { type: 'BLANK' },
    { type: 'PARA',  text: '______________________________' },
    { type: 'PARA',  text: judgeName || 'Judge' },
    { type: 'PARA',  text: judgeTitle },
  ];

  const allLines = [...captionLines, ...buildBodyLines(allBlocks, fonts)];

  const pages = [];
  for (let i = 0; i < allLines.length; i += PP.NUM_LINES) {
    pages.push(allLines.slice(i, i + PP.NUM_LINES));
  }
  if (pages.length === 0) pages.push([]);

  const footerTitle = sanitize(state.footerTitle || '[PROPOSED] ORDER');
  for (let pi = 0; pi < pages.length; pi++) {
    const page      = doc.addPage([PP.PAGE_W, PP.PAGE_H]);
    const pageLines = pages[pi];
    drawPageFrame(page, pi + 1, footerTitle, fonts);
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
// BUILD PROOF OF SERVICE BY MAIL PDF
// ============================================================
async function buildProofOfServicePDF(state) {
  const { PDFDocument, StandardFonts } = PDFLib;
  const doc   = await PDFDocument.create();
  const fR    = await doc.embedFont(StandardFonts.TimesRoman);
  const fB    = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fI    = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const BLACK = PDFLib.rgb(0, 0, 0);

  const { BODY_LEFT: BL, BODY_WIDTH: BW, BODY_TOP, BODY_BOT, LINE_H,
          FS_TITLE, FS_BODY, FS_SMALL } = CL;

  let page = doc.addPage([CL.PAGE_W, CL.PAGE_H]);
  let y    = BODY_TOP;

  function ensureSpace(n) {
    if (y < BODY_BOT + n * LINE_H) { page = doc.addPage([CL.PAGE_W, CL.PAGE_H]); y = BODY_TOP; }
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
    if (!s) { y -= LINE_H; return; }
    let w; try { w = font.widthOfTextAtSize(s, size); } catch (e) { w = s.length * size * 0.55; }
    page.drawText(s, { x: BL + (BW - w) / 2, y, font, size, color: BLACK });
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

  // Title
  drawCentered('PROOF OF SERVICE BY MAIL', fB, FS_TITLE);
  skip(1);

  // Case / Court header
  const caseNo   = sanitize(state.caseNumber || '_______________');
  const caseName = sanitize(state.plaintiff  || '');
  drawLeft('Case Name: ' + caseName, fR, FS_BODY);
  drawLeft('Case No.: '  + caseNo,   fR, FS_BODY);
  let courtLine = state.courtName || '';
  if (state.county) courtLine += (courtLine ? ', County of ' : 'County of ') + state.county;
  if (courtLine) drawLeft(sanitize(courtLine), fR, FS_SMALL);
  skip(1);

  // Declaration intro
  const declarant = sanitize(state.posSignerName || state.plaintiff || '_______________');
  drawWrapped(`I, ${declarant}, declare:`, fR, FS_BODY, 0);
  skip(1);

  // Paragraph 1 — identity and capacity
  drawWrapped('1.  I am over the age of eighteen (18) years and not a party to the above-entitled action. I am a resident of, or employed in, the county where the mailing occurred.', fR, FS_BODY, 0);
  skip(1);

  // Paragraph 2 — service date and documents
  const svcDate = sanitize(state.posServiceDate || '_______________');
  drawWrapped(`2.  On ${svcDate}, I served the following document(s):`, fR, FS_BODY, 0);
  skip(0.5);
  const docs = (state.posDocuments || '').split('\n').map(s => s.trim()).filter(Boolean);
  for (const d of docs) drawLeft('    ' + d, fB, FS_BODY);
  skip(1);

  // Paragraph 3 — method
  drawWrapped(
    '3.  I served the above-named document(s) by enclosing a true copy in a sealed envelope addressed to each person whose name and address is listed below, and by placing each envelope for collection and mailing following ordinary business practices. I am readily familiar with the practice for collection and processing of correspondence for mailing. Under this practice, it would be deposited with the United States Postal Service on that same day in the ordinary course of business, with postage fully prepaid.',
    fR, FS_BODY, 0
  );
  skip(1);

  // Paragraph 4 — recipients
  drawWrapped('4.  The envelope(s) were addressed and mailed as follows:', fR, FS_BODY, 0);
  skip(0.5);
  const recBlocks = (state.posRecipients || '').split(/\n\s*\n/).filter(b => b.trim());
  for (const block of recBlocks) {
    for (const line of block.split('\n').map(l => l.trim()).filter(Boolean)) {
      drawLeft('    ' + line, fR, FS_BODY);
    }
    skip(0.5);
  }

  // Perjury declaration
  skip(0.5);
  const execDate = sanitize(state.posExecDate || '_______________');
  const execCity = sanitize(state.posExecCity || '_______________');
  drawWrapped(
    `I declare under penalty of perjury under the laws of the State of California that the foregoing is true and correct. Executed on ${execDate}, at ${execCity}.`,
    fI, FS_BODY, 0
  );
  skip(2);

  // Signature block
  ensureSpace(4);
  const SIG_W  = 240;
  page.drawLine({ start: { x: BL, y }, end: { x: BL + SIG_W, y }, thickness: 0.6, color: BLACK });
  y -= LINE_H;
  const sigName  = sanitize(state.posSignerName || state.plaintiff || '');
  const sigTitle = sanitize(state.posSignerTitle || '');
  if (sigName)  page.drawText(sigName,  { x: BL, y, font: fR, size: FS_SMALL, color: BLACK });
  y -= LINE_H;
  if (sigTitle) page.drawText(sigTitle, { x: BL, y, font: fR, size: FS_SMALL, color: BLACK });

  return doc.save();
}

// ============================================================
// PDF OUTPUT HELPERS
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

function openPDF(bytes) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ============================================================
// FORMAT TOOLBAR
// ============================================================
function initFormatToolbar() {
  const ta = document.getElementById('pleading-body');
  ta.addEventListener('input', updateLineCounter);

  const declTa = document.getElementById('decl-body');
  if (declTa) declTa.addEventListener('input', updateDeclLineCounter);

  document.querySelectorAll('.fmt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Use data-target to support multiple format toolbars
      const targetId = btn.dataset.target || 'pleading-body';
      const target   = document.getElementById(targetId) || ta;
      const fmt      = btn.dataset.fmt;
      const start    = target.selectionStart;
      const end      = target.selectionEnd;
      const sel      = target.value.slice(start, end);

      let replacement = sel;
      if (fmt === 'header') {
        replacement = sel.toUpperCase();
      } else if (fmt === 'list') {
        let counter = 1;
        replacement = sel.split('\n').map(line =>
          line.trim() ? (counter++) + '. ' + line.replace(/^\d+[\.\)]\s*/, '') : line
        ).join('\n');
      } else if (fmt === 'paragraph' || fmt === 'para') {
        replacement = sel.split('\n').map(line =>
          line.replace(/^\d+[\.\)]\s+/, '')
        ).join('\n');
      }

      target.setRangeText(replacement, start, end, 'select');
      target.dispatchEvent(new Event('input'));
      target.focus();
    });
  });
}

// ============================================================
// LINE COUNTER  (body textarea → estimated PDF lines / pages)
// ============================================================
function estimateBodyLines(raw) {
  if (!raw || !raw.trim()) return 0;
  const CHARS_PER_LINE = 62; // conservative est. for Times 12pt at ~471pt content width
  const INDENT         = 6;  // ~36pt first-line indent / 6pt avg char
  const blocks = parseBodyText(raw);
  let count = 0;
  for (const block of blocks) {
    if (block.type === 'HEADER') {
      count += 2 + (Math.ceil(sanitize(block.text).length / CHARS_PER_LINE) || 1);
    } else if (block.type === 'PARA') {
      const words = sanitize(block.text).split(/\s+/).filter(Boolean);
      if (!words.length) continue;
      let lines = 1, lineLen = 0, first = true;
      for (const w of words) {
        const max = first ? CHARS_PER_LINE - INDENT : CHARS_PER_LINE;
        if (lineLen === 0)                          { lineLen = w.length; }
        else if (lineLen + 1 + w.length <= max)    { lineLen += 1 + w.length; }
        else                                        { lines++; first = false; lineLen = w.length; }
      }
      count += lines;
    } else if (block.type === 'LIST_ITEM') {
      count += Math.ceil(sanitize(block.text).length / (CHARS_PER_LINE - INDENT)) || 1;
    }
  }
  return count;
}

function updateLineCounter() {
  const el = document.getElementById('pleading-line-counter');
  if (!el) return;
  const raw   = document.getElementById('pleading-body').value;
  const lines = estimateBodyLines(raw);
  if (!lines) { el.textContent = ''; el.className = 'line-counter'; return; }
  const pages  = Math.ceil(lines / PP.NUM_LINES);
  const onPage = lines % PP.NUM_LINES || PP.NUM_LINES;
  el.className   = 'line-counter' + (onPage > 24 ? ' warn' : '');
  el.textContent = `~${lines} body lines · ~${pages} page${pages !== 1 ? 's' : ''} (28 lines/page)`;
}

function updateDeclLineCounter() {
  const el = document.getElementById('decl-line-counter');
  if (!el) return;
  const raw   = document.getElementById('decl-body').value;
  const lines = estimateBodyLines(raw);
  if (!lines) { el.textContent = ''; el.className = 'line-counter'; return; }
  const pages  = Math.ceil(lines / PP.NUM_LINES);
  const onPage = lines % PP.NUM_LINES || PP.NUM_LINES;
  el.className   = 'line-counter' + (onPage > 24 ? ' warn' : '');
  el.textContent = `~${lines} body lines · ~${pages} page${pages !== 1 ? 's' : ''} (28 lines/page)`;
}

// ============================================================
// NAMED CASE PROFILES
// ============================================================
const PROFILES_KEY = 'pleading_profiles_v1';

function loadProfiles() {
  try { return JSON.parse(localStorage.getItem(PROFILES_KEY) || '{}'); } catch (e) { return {}; }
}

function saveProfiles(profiles) {
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); } catch (e) {}
}

function refreshProfileSelect() {
  const sel = document.getElementById('profile-select');
  const profiles = loadProfiles();
  const current = sel.value;
  sel.innerHTML = '<option value="">— select —</option>';
  for (const name of Object.keys(profiles).sort()) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  }
  if (current && profiles[current]) sel.value = current;
}

function initProfiles() {
  refreshProfileSelect();

  document.getElementById('btn-profile-save').addEventListener('click', () => {
    const name = prompt('Save profile as:', document.getElementById('profile-select').value || '');
    if (!name || !name.trim()) return;
    const profiles = loadProfiles();
    profiles[name.trim()] = { ...STATE };
    saveProfiles(profiles);
    refreshProfileSelect();
    document.getElementById('profile-select').value = name.trim();
  });

  document.getElementById('btn-profile-load').addEventListener('click', () => {
    const name = document.getElementById('profile-select').value;
    if (!name) return;
    const profiles = loadProfiles();
    if (!profiles[name]) return;
    Object.assign(STATE, profiles[name]);
    saveState();
    applyStateToFields();
  });

  document.getElementById('btn-profile-delete').addEventListener('click', () => {
    const name = document.getElementById('profile-select').value;
    if (!name) return;
    if (!confirm(`Delete profile "${name}"?`)) return;
    const profiles = loadProfiles();
    delete profiles[name];
    saveProfiles(profiles);
    refreshProfileSelect();
  });

  document.getElementById('btn-profile-export').addEventListener('click', () => {
    const name = document.getElementById('profile-select').value || 'profile';
    const data = JSON.stringify({ ...STATE }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url, download: name.replace(/\s+/g, '_') + '.json'
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });

  document.getElementById('btn-profile-duplicate').addEventListener('click', () => {
    const name = document.getElementById('profile-select').value;
    if (!name) { alert('Select a profile to duplicate.'); return; }
    const profiles = loadProfiles();
    if (!profiles[name]) return;
    let newName = name + ' (copy)';
    let i = 2;
    while (profiles[newName]) { newName = name + ' (copy ' + i++ + ')'; }
    profiles[newName] = { ...profiles[name] };
    saveProfiles(profiles);
    refreshProfileSelect();
    document.getElementById('profile-select').value = newName;
  });

  document.getElementById('btn-profile-export-all').addEventListener('click', () => {
    const profiles = loadProfiles();
    if (!Object.keys(profiles).length) { alert('No saved profiles to export.'); return; }
    const blob = new Blob([JSON.stringify(profiles, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'all-profiles.json' });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });

  document.getElementById('profile-import-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target.result);
        Object.assign(STATE, imported);
        saveState();
        applyStateToFields();
        e.target.value = '';
      } catch (err) {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  });
}

function applyStateToFields() {
  FIELD_MAP.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.value = STATE[key];
  });
  // Restore court select
  const sel    = document.getElementById('prof-court');
  const custom = document.getElementById('prof-court-custom');
  const knownValues = Array.from(sel.options).map(o => o.value);
  if (STATE.courtName && !knownValues.includes(STATE.courtName)) {
    sel.value    = '__custom__';
    custom.value = STATE.courtName;
    custom.style.display = '';
  } else {
    sel.value = STATE.courtName || sel.options[1]?.value || '';
    custom.style.display = 'none';
  }
}

// ============================================================
// BUTTON HANDLERS
// ============================================================
function initButtons() {
  async function generate(btnId, openBtnId, statusId, buildFn, filenameFn, mode) {
    const btn    = document.getElementById(btnId);
    const openBtn = openBtnId ? document.getElementById(openBtnId) : null;
    const status = document.getElementById(statusId);

    // Validation
    const errors = validateState(STATE);
    if (errors.length) {
      status.textContent = errors[0];
      status.className   = 'status-msg error';
      return;
    }

    const active = mode === 'open' ? openBtn : btn;
    if (active) active.disabled = true;
    if (btn)    btn.disabled    = true;
    if (openBtn) openBtn.disabled = true;
    status.textContent = 'Generating...';
    status.className   = 'status-msg';
    try {
      const bytes = await buildFn(STATE);
      if (mode === 'open') {
        openPDF(bytes);
        status.textContent = 'Opened in new tab.';
      } else {
        downloadPDF(bytes, filenameFn(STATE));
        status.textContent = 'PDF downloaded.';
      }
      status.className = 'status-msg success';
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
      status.className   = 'status-msg error';
      console.error(err);
    } finally {
      if (btn)     btn.disabled     = false;
      if (openBtn) openBtn.disabled = false;
    }
  }

  const pleadingFile = s => 'Pleading_Paper_' + (s.plaintiff || 'Document').replace(/\s+/g, '_') + '.pdf';
  const certFile     = s => 'Certificate_of_Service_' + (s.plaintiff || 'Document').replace(/\s+/g, '_') + '.pdf';

  document.getElementById('btn-generate-pleading').addEventListener('click', () =>
    generate('btn-generate-pleading', 'btn-open-pleading', 'pleading-status', buildPleadingPDF, pleadingFile, 'download')
  );
  document.getElementById('btn-open-pleading').addEventListener('click', () =>
    generate('btn-generate-pleading', 'btn-open-pleading', 'pleading-status', buildPleadingPDF, pleadingFile, 'open')
  );

  document.getElementById('btn-generate-cert').addEventListener('click', () =>
    generate('btn-generate-cert', 'btn-open-cert', 'cert-status', buildCertificatePDF, certFile, 'download')
  );
  document.getElementById('btn-open-cert').addEventListener('click', () =>
    generate('btn-generate-cert', 'btn-open-cert', 'cert-status', buildCertificatePDF, certFile, 'open')
  );

  const posFile = s => 'Proof_of_Service_' + (s.plaintiff || 'Document').replace(/\s+/g, '_') + '.pdf';
  document.getElementById('btn-generate-pos').addEventListener('click', () =>
    generate('btn-generate-pos', 'btn-open-pos', 'pos-status', buildProofOfServicePDF, posFile, 'download')
  );
  document.getElementById('btn-open-pos').addEventListener('click', () =>
    generate('btn-generate-pos', 'btn-open-pos', 'pos-status', buildProofOfServicePDF, posFile, 'open')
  );
  document.getElementById('btn-preview-pos').addEventListener('click', () =>
    showPreview('pos-preview-pane', 'pos-preview-frame', 'pos-status', buildProofOfServicePDF)
  );

  const orderFile = s => 'Proposed_Order_' + (s.plaintiff || 'Document').replace(/\s+/g, '_') + '.pdf';
  document.getElementById('order-download-btn').addEventListener('click', () =>
    generate('order-download-btn', 'order-open-btn', 'order-status', buildProposedOrderPDF, orderFile, 'download')
  );
  document.getElementById('order-open-btn').addEventListener('click', () =>
    generate('order-download-btn', 'order-open-btn', 'order-status', buildProposedOrderPDF, orderFile, 'open')
  );
  document.getElementById('order-preview-btn').addEventListener('click', () =>
    showPreview('order-preview-pane', 'order-preview-frame', 'order-status', buildProposedOrderPDF)
  );

  const declFile = s => 'Declaration_' + (s.plaintiff || 'Document').replace(/\s+/g, '_') + '.pdf';
  document.getElementById('decl-download-btn').addEventListener('click', () =>
    generate('decl-download-btn', 'decl-open-btn', 'decl-status', buildDeclarationPDF, declFile, 'download')
  );
  document.getElementById('decl-open-btn').addEventListener('click', () =>
    generate('decl-download-btn', 'decl-open-btn', 'decl-status', buildDeclarationPDF, declFile, 'open')
  );
  document.getElementById('decl-preview-btn').addEventListener('click', () =>
    showPreview('decl-preview-pane', 'decl-preview-frame', 'decl-status', buildDeclarationPDF)
  );

  // Today buttons — specific IDs (legacy) + generic data-target approach
  document.getElementById('btn-today-service').addEventListener('click', () => {
    const el = document.getElementById('cert-service-date');
    el.value = todayLong(); STATE.serviceDate = el.value; saveState();
  });
  document.getElementById('btn-today-exec').addEventListener('click', () => {
    const el = document.getElementById('cert-exec-date');
    el.value = todayLong(); STATE.execDate = el.value; saveState();
  });
  document.getElementById('btn-today-pos').addEventListener('click', () => {
    const el = document.getElementById('pos-service-date');
    el.value = todayLong(); STATE.posServiceDate = el.value; saveState();
  });
  document.getElementById('btn-today-pos-exec').addEventListener('click', () => {
    const el = document.getElementById('pos-exec-date');
    el.value = todayLong(); STATE.posExecDate = el.value; saveState();
  });
  // Generic Today buttons (data-target attribute)
  document.querySelectorAll('.btn-today[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = document.getElementById(btn.dataset.target);
      if (!el) return;
      el.value = todayLong();
      const entry = FIELD_MAP.find(([id]) => id === btn.dataset.target);
      if (entry) { STATE[entry[1]] = el.value; saveState(); }
    });
  });

  // Preview buttons
  async function showPreview(paneId, frameId, statusId, buildFn) {
    const pane   = document.getElementById(paneId);
    const frame  = document.getElementById(frameId);
    const status = document.getElementById(statusId);
    const errors = validateState(STATE);
    if (errors.length) {
      status.textContent = errors[0];
      status.className   = 'status-msg error';
      return;
    }
    status.textContent = 'Generating preview...';
    status.className   = 'status-msg';
    try {
      const bytes = await buildFn(STATE);
      const blob  = new Blob([bytes], { type: 'application/pdf' });
      const url   = URL.createObjectURL(blob);
      if (frame.src && frame.src.startsWith('blob:')) URL.revokeObjectURL(frame.src);
      frame.src = url;
      pane.style.display = '';
      status.textContent = '';
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
      status.className   = 'status-msg error';
    }
  }

  document.getElementById('btn-preview-pleading').addEventListener('click', () =>
    showPreview('pleading-preview-pane', 'pleading-preview-frame', 'pleading-status', buildPleadingPDF)
  );
  document.getElementById('btn-preview-cert').addEventListener('click', () =>
    showPreview('cert-preview-pane', 'cert-preview-frame', 'cert-status', buildCertificatePDF)
  );

  // Clear / New Case
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm('Clear all fields and start a new case? This cannot be undone.')) clearState();
  });
}

// ============================================================
// CHARACTER COUNT BADGES
// ============================================================
function initCharCounts() {
  function bind(inputId, badgeId, warnAt) {
    const input = document.getElementById(inputId);
    const badge = document.getElementById(badgeId);
    if (!input || !badge) return;
    function update() {
      const len = input.value.length;
      if (!len) { badge.textContent = ''; badge.className = 'char-count'; return; }
      badge.textContent = len + ' ch';
      badge.className   = 'char-count' + (len > warnAt ? ' warn' : '');
    }
    input.addEventListener('input', update);
    update();
  }
  bind('prof-plaintiff',   'count-plaintiff',   55);
  bind('prof-case-number', 'count-case-number', 25);
  // docType is a textarea — warn on longest line length
  const dtEl  = document.getElementById('prof-doc-type');
  const dtBdg = document.getElementById('count-doc-type');
  if (dtEl && dtBdg) {
    function updateDocType() {
      const max = Math.max(0, ...dtEl.value.split('\n').map(l => l.length));
      if (!max) { dtBdg.textContent = ''; dtBdg.className = 'char-count'; return; }
      dtBdg.textContent = max + ' ch';
      dtBdg.className   = 'char-count' + (max > 30 ? ' warn' : '');
    }
    dtEl.addEventListener('input', updateDocType);
    updateDocType();
  }
}

// ============================================================
// AUTO-PREVIEW  (refreshes open preview pane after typing)
// ============================================================
let _autoPreviewTimer = null;
function scheduleAutoPreview() {
  clearTimeout(_autoPreviewTimer);
  _autoPreviewTimer = setTimeout(async () => {
    const activeBtn = document.querySelector('.tab-btn.active');
    if (!activeBtn) return;
    const tab = activeBtn.dataset.tab;
    const MAP = {
      pleading:     ['pleading-preview-pane', 'pleading-preview-frame', 'pleading-status', buildPleadingPDF],
      certificate:  ['cert-preview-pane',     'cert-preview-frame',     'cert-status',     buildCertificatePDF],
      pos:          ['pos-preview-pane',       'pos-preview-frame',      'pos-status',      buildProofOfServicePDF],
      declaration:  ['decl-preview-pane',      'decl-preview-frame',     'decl-status',     buildDeclarationPDF],
      order:        ['order-preview-pane',     'order-preview-frame',    'order-status',    buildProposedOrderPDF],
    };
    const cfg = MAP[tab];
    if (!cfg) return;
    const pane = document.getElementById(cfg[0]);
    if (!pane || pane.style.display === 'none') return; // only refresh if preview already open
    const frame  = document.getElementById(cfg[1]);
    const status = document.getElementById(cfg[2]);
    const buildFn = cfg[3];
    status.textContent = 'Updating…';
    status.className   = 'status-msg';
    try {
      const bytes = await buildFn(STATE);
      const blob  = new Blob([bytes], { type: 'application/pdf' });
      const url   = URL.createObjectURL(blob);
      if (frame.src && frame.src.startsWith('blob:')) URL.revokeObjectURL(frame.src);
      frame.src = url;
      status.textContent = '';
    } catch (err) {
      status.textContent = 'Preview error: ' + err.message;
      status.className   = 'status-msg error';
    }
  }, 700);
}

function initAutoPreview() {
  FIELD_MAP.forEach(([id]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', scheduleAutoPreview);
  });
  document.getElementById('prof-court').addEventListener('change', scheduleAutoPreview);
  document.getElementById('prof-court-custom').addEventListener('input', scheduleAutoPreview);
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const tab = document.querySelector('.tab-btn.active')?.dataset.tab;
    // Ctrl/Cmd+G — download PDF for the active tab
    if (e.key === 'g' || e.key === 'G') {
      const IDS = { pleading: 'btn-generate-pleading', certificate: 'btn-generate-cert', pos: 'btn-generate-pos', declaration: 'decl-download-btn', order: 'order-download-btn' };
      if (IDS[tab]) { e.preventDefault(); document.getElementById(IDS[tab])?.click(); }
    }
    // Ctrl/Cmd+Shift+S — save profile
    if (e.shiftKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      document.getElementById('btn-profile-save')?.click();
    }
  });
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
  initProfiles();
  initFormatToolbar();
  initButtons();
  initCharCounts();
  initAutoPreview();
  initKeyboardShortcuts();
  updateLineCounter();
  updateDeclLineCounter();
});
