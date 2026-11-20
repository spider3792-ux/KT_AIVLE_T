// Builds one week's review note files from review/<id>.json:
//   review/<id>.docx  (editable, made with the docx package)
//   review/<id>.pdf   (Word on this PC exports the .docx, so both look the same)
//   node scripts/build-note.mjs <week-id> [--no-pdf]
// Exit 0 ok, 1 the note has problems, 2 usage / Word problem.
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, AlignmentType, LevelFormat, PageBreak, Footer, PageNumber,
} from 'docx';
import { checkNote, inlineParts, NOTE_ID } from '../js/note-format.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const id = args.find((a) => NOTE_ID.test(a));
const fail = (code, msg) => {
  console.error(msg);
  process.exit(code);
};
if (!id) fail(2, '사용법: node scripts/build-note.mjs <주차 id, 예: 2026-W47> [--no-pdf]');

const jsonPath = path.join(ROOT, 'review', `${id}.json`);
if (!existsSync(jsonPath)) fail(2, `노트 파일이 없어요: review/${id}.json`);
let note;
try {
  note = JSON.parse(readFileSync(jsonPath, 'utf8').replace(/^﻿/, ''));
} catch (err) {
  fail(1, `review/${id}.json을 JSON으로 읽지 못했어요: ${err.message}`);
}
const problems = checkNote(note, id);
if (problems.length) fail(1, problems.map((p) => `노트 오류: ${p}`).join('\n'));

// ---------------------------------------------------------------- docx pieces

const FONT = 'Malgun Gothic';
const MONO = 'Consolas';
const ACCENT = '1F3038'; // the site's ink
const TEAL = '0D7480'; // the site's accent
const CONTENT_W = 9638; // A4 width 11906 - 2 x 1134

const runs = (text, base = {}) =>
  inlineParts(text).map((part) =>
    part.kind === 'bold'
      ? new TextRun({ text: part.text, bold: true, font: FONT, ...base })
      : part.kind === 'code'
      ? new TextRun({ text: part.text, font: MONO, color: TEAL, ...base })
      : new TextRun({ text: part.text, font: FONT, ...base }),
  );

const para = (t) => new Paragraph({ children: runs(t), spacing: { after: 100, line: 300 } });

const bullets = (items) =>
  items.map((t) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, children: runs(t), spacing: { after: 60, line: 290 } }));

function code(src) {
  const lines = src.split('\n');
  return lines.map(
    (ln, i) =>
      new Paragraph({
        children: [new TextRun({ text: ln.length ? ln : ' ', font: MONO, size: 18 })],
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'ECF0F2' },
        spacing: { before: i === 0 ? 80 : 0, after: i === lines.length - 1 ? 140 : 0, line: 250 },
        indent: { left: 200, right: 200 },
      }),
  );
}

function box(label, lines, fill, edge) {
  const side = { left: { style: BorderStyle.SINGLE, size: 18, color: edge, space: 8 } };
  return [
    new Paragraph({
      children: [new TextRun({ text: label, bold: true, font: FONT, color: edge })],
      shading: { type: ShadingType.CLEAR, color: 'auto', fill },
      border: side,
      indent: { left: 160 },
      spacing: { before: 100, after: 0 },
    }),
    ...lines.map(
      (t, i) =>
        new Paragraph({
          children: runs(lines.length > 1 ? `• ${t}` : t),
          shading: { type: ShadingType.CLEAR, color: 'auto', fill },
          border: side,
          indent: { left: 160 },
          spacing: { after: i === lines.length - 1 ? 160 : 0, line: 290 },
        }),
    ),
  ];
}

function table(b) {
  const raw = b.widths || b.head.map(() => 1);
  const sum = raw.reduce((a, c) => a + c, 0);
  const widths = raw.map((w) => Math.round((w / sum) * CONTENT_W));
  const cell = (t, head, w) =>
    new TableCell({
      width: { size: w, type: WidthType.DXA },
      shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: 'DCE5EA' } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: runs(t, head ? { bold: true, size: 19 } : { size: 19 }), spacing: { line: 270 } })],
    });
  return [
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: widths,
      rows: [
        new TableRow({ tableHeader: true, children: b.head.map((t, i) => cell(t, true, widths[i])) }),
        ...b.rows.map((r) => new TableRow({ children: r.map((t, i) => cell(t, false, widths[i])) })),
      ],
    }),
    new Paragraph({ children: [], spacing: { after: 120 } }),
  ];
}

function block(b) {
  if (b.type === 'p') return [para(b.text)];
  if (b.type === 'list') return bullets(b.items);
  if (b.type === 'code') return code(b.text);
  if (b.type === 'table') return table(b);
  if (b.type === 'tip') return box('헷갈리기 쉬운 점', b.items, 'FFF4E5', 'B4540F');
  return box('이것만 기억', b.items, 'E3F1F2', TEAL);
}

const body = [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: note.title })] })];
for (const t of note.lead || []) body.push(para(t));
note.sections.forEach((s, i) => {
  // every top-level part after the first starts on a new page, like the hand-made notes
  if (s.level === 1 && i > 0) body.push(new Paragraph({ children: [new PageBreak()] }));
  body.push(new Paragraph({ heading: s.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, children: [new TextRun({ text: s.heading })] }));
  if (s.ref) body.push(new Paragraph({ children: [new TextRun({ text: s.ref, font: FONT, size: 18, color: '5D6B72', italics: true })], spacing: { after: 80 } }));
  for (const b of s.blocks) body.push(...block(b));
});

const doc = new Document({
  creator: '스터디 복습 퀴즈',
  title: note.title,
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 40, bold: true, color: ACCENT }, paragraph: { spacing: { before: 0, after: 240 }, keepNext: true } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 30, bold: true, color: ACCENT }, paragraph: { spacing: { before: 240, after: 160 }, keepNext: true, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 4 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 25, bold: true, color: '2E2E2E' }, paragraph: { spacing: { before: 320, after: 60 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 260 } } } }] }],
  },
  sections: [
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: '7F7F7F' })] })] }) },
      children: body,
    },
  ],
});

const docxPath = path.join(ROOT, 'review', `${id}.docx`);
const pdfPath = path.join(ROOT, 'review', `${id}.pdf`);
writeFileSync(docxPath, await Packer.toBuffer(doc));
console.log(`만들었어요: review/${id}.docx`);
if (args.includes('--no-pdf')) process.exit(0);

// ---------------------------------------------------------------- pdf through Word (paths go in env vars, never into the command text)
if (existsSync(pdfPath)) rmSync(pdfPath);
const ps = [
  '$ErrorActionPreference = "Stop"',
  '$w = New-Object -ComObject Word.Application',
  '$w.Visible = $false',
  'try { $d = $w.Documents.Open($env:NOTE_DOCX, $false, $true); $d.ExportAsFixedFormat($env:NOTE_PDF, 17); $d.Close($false) } finally { $w.Quit() }',
].join('; ');
const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
  env: { ...process.env, NOTE_DOCX: docxPath, NOTE_PDF: pdfPath },
  encoding: 'utf8',
});
if (r.status !== 0 || !existsSync(pdfPath)) {
  fail(2, `PDF를 만들지 못했어요. 이 PC에 Microsoft Word가 있어야 해요.\n${(r.stderr || r.error?.message || '').trim()}`);
}
console.log(`만들었어요: review/${id}.pdf`);
