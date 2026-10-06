// VisionWeaver Book Pipeline: Layer 4, output assembly.
// Pure functions: structured chapters in, Markdown / PDF / EPUB bytes out.
// No network and no database here, so this file can be tested on its own.
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import JSZip from 'npm:jszip@3.10.1';

export type AssemblyChapter = { number: number; title: string; markdown: string };
export type AssemblySource = { title: string; url: string };
export type CoverImage = { bytes: Uint8Array; mime: string };
export type AssemblyBook = {
  title: string;
  subtitle: string;
  author: string;
  year: number;
  description: string;
  language: string;
  isbn: string;
  trim: '6x9' | '8.5x11';
  chapters: AssemblyChapter[];
  sources: AssemblySource[];
  cover: CoverImage | null;
};
export type FontBytes = { regular: Uint8Array; bold: Uint8Array; italic: Uint8Array; boldItalic: Uint8Array };

export const AUTHOR_PLACEHOLDER = '[Author name to be added]';

type Run = { text: string; bold: boolean; italic: boolean };
type Block = { type: 'p' | 'h2' | 'h3' | 'quote' | 'li' | 'oli' | 'hr'; runs: Run[]; marker: string };

// ------------------------------------------------------------ markdown
export function stripLeadingHeading(markdown: string) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  if (lines.length && /^#\s+/.test(lines[0])) lines.shift();
  return lines.join('\n').trim();
}

export function parseInline(text: string): Run[] {
  const runs: Run[] = [];
  let bold = false;
  let italic = false;
  let buffer = '';
  const flush = () => { if (buffer) { runs.push({ text: buffer, bold, italic }); buffer = ''; } };
  const source = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '\\' && next && /[\\*_`#>\-\[\]]/.test(next)) { buffer += next; index += 1; continue; }
    if (char === '*' && next === '*') { flush(); bold = !bold; index += 1; continue; }
    if (char === '_' && next === '_') { flush(); bold = !bold; index += 1; continue; }
    if (char === '*') {
      const opening = !italic && next !== undefined && !/\s/.test(next);
      const closing = italic && index > 0 && !/\s/.test(source[index - 1]);
      if (opening || closing) { flush(); italic = !italic; continue; }
    }
    if (char === '_') {
      const before = index > 0 ? source[index - 1] : ' ';
      const opening = !italic && /[\s(\[{"'“‘]/.test(before) && next !== undefined && !/\s/.test(next);
      const closing = italic && (next === undefined || /[\s.,;:!?)\]}"'”’]/.test(next));
      if (opening || closing) { flush(); italic = !italic; continue; }
    }
    buffer += char;
  }
  flush();
  return runs.length ? runs : [{ text: '', bold: false, italic: false }];
}

export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  let paragraph: string[] = [];
  let quote: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) { blocks.push({ type: 'p', runs: parseInline(paragraph.join(' ')), marker: '' }); paragraph = []; }
  };
  const flushQuote = () => {
    if (quote.length) { blocks.push({ type: 'quote', runs: parseInline(quote.join(' ')), marker: '' }); quote = []; }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushParagraph(); flushQuote(); continue; }
    if (/^(\*\s*\*\s*\*|-\s*-\s*-|_\s*_\s*_)[\s*_-]*$/.test(line)) { flushParagraph(); flushQuote(); blocks.push({ type: 'hr', runs: [], marker: '' }); continue; }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph(); flushQuote();
      blocks.push({ type: heading[1].length <= 2 ? 'h2' : 'h3', runs: parseInline(heading[2].replace(/\s+#+$/, '')), marker: '' });
      continue;
    }
    if (line.startsWith('>')) { flushParagraph(); quote.push(line.replace(/^>\s?/, '')); continue; }
    flushQuote();
    const bullet = line.match(/^[-*+]\s+(.*)$/);
    if (bullet) { flushParagraph(); blocks.push({ type: 'li', runs: parseInline(bullet[1]), marker: '•' }); continue; }
    const ordered = line.match(/^(\d{1,3})[.)]\s+(.*)$/);
    if (ordered) { flushParagraph(); blocks.push({ type: 'oli', runs: parseInline(ordered[2]), marker: ordered[1] + '.' }); continue; }
    paragraph.push(line);
  }
  flushParagraph(); flushQuote();
  return blocks;
}

export function countWords(markdown: string) {
  const text = String(markdown || '').replace(/[#>*_`\-]/g, ' ');
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return words ? words.length : 0;
}

export function buildManuscriptMarkdown(book: AssemblyBook) {
  const parts: string[] = [];
  parts.push('# ' + book.title);
  if (book.subtitle) parts.push('*' + book.subtitle + '*');
  parts.push('By ' + (book.author || AUTHOR_PLACEHOLDER));
  parts.push('---');
  for (const chapter of book.chapters) {
    parts.push('## Chapter ' + chapter.number + ': ' + chapter.title);
    parts.push(stripLeadingHeading(chapter.markdown));
  }
  if (book.sources.length) {
    parts.push('## Sources');
    parts.push(book.sources.map((source, index) => (index + 1) + '. ' + source.title + ' ' + source.url).join('\n'));
  }
  return parts.join('\n\n') + '\n';
}

// ---------------------------------------------------------------- epub
function xml(value: string) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function runsToXhtml(runs: Run[]) {
  return runs.map((run) => {
    let out = xml(run.text);
    if (run.italic) out = '<em>' + out + '</em>';
    if (run.bold) out = '<strong>' + out + '</strong>';
    return out;
  }).join('');
}

export function markdownToXhtml(markdown: string) {
  const blocks = parseBlocks(markdown);
  const out: string[] = [];
  let list: '' | 'ul' | 'ol' = '';
  const closeList = () => { if (list) { out.push('</' + list + '>'); list = ''; } };
  for (const block of blocks) {
    if (block.type === 'li' || block.type === 'oli') {
      const wanted = block.type === 'li' ? 'ul' : 'ol';
      if (list !== wanted) { closeList(); out.push('<' + wanted + '>'); list = wanted; }
      out.push('<li>' + runsToXhtml(block.runs) + '</li>');
      continue;
    }
    closeList();
    if (block.type === 'hr') out.push('<p class="break">* * *</p>');
    else if (block.type === 'h2') out.push('<h2>' + runsToXhtml(block.runs) + '</h2>');
    else if (block.type === 'h3') out.push('<h3>' + runsToXhtml(block.runs) + '</h3>');
    else if (block.type === 'quote') out.push('<blockquote><p>' + runsToXhtml(block.runs) + '</p></blockquote>');
    else out.push('<p>' + runsToXhtml(block.runs) + '</p>');
  }
  closeList();
  return out.join('\n');
}

function xhtmlPage(title: string, body: string, language: string, extraHead = '') {
  return '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n' +
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="' + xml(language) + '" lang="' + xml(language) + '">\n' +
    '<head><meta charset="utf-8"/><title>' + xml(title) + '</title><link rel="stylesheet" type="text/css" href="../css/style.css"/>' + extraHead + '</head>\n' +
    '<body>\n' + body + '\n</body>\n</html>\n';
}

function wrapWords(text: string, maxChars: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + ' ' + word).length > maxChars) { lines.push(line); line = word; }
    else line = line ? line + ' ' + word : word;
  }
  if (line) lines.push(line);
  return lines;
}

function imageExtension(mime: string) {
  if (/png/i.test(mime)) return 'png';
  if (/webp/i.test(mime)) return 'webp';
  return 'jpg';
}

export function sniffImageMime(bytes: Uint8Array, fallback = 'image/jpeg') {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  return fallback;
}

const EPUB_CSS = `body{font-family:Georgia,"Times New Roman",serif;line-height:1.55;margin:5%;}
h1{font-size:1.7em;text-align:center;margin:2.2em 0 .4em;line-height:1.25;}
h2{font-size:1.25em;margin:1.6em 0 .5em;}
h3{font-size:1.08em;font-style:italic;margin:1.3em 0 .4em;}
p{margin:0;text-indent:1.4em;text-align:justify;}
h1+p,h2+p,h3+p,p.first,blockquote p,p.break+p{text-indent:0;}
p.break{text-align:center;text-indent:0;margin:1.2em 0;}
p.label{text-align:center;text-indent:0;letter-spacing:.18em;font-size:.8em;margin-top:3em;text-transform:uppercase;}
blockquote{margin:1em 1.6em;font-style:italic;}
ul,ol{margin:.8em 0 .8em 1.4em;}
.titlepage{text-align:center;margin-top:22%;}
.titlepage h1{font-size:2.1em;margin:0 0 .4em;}
.titlepage p{text-indent:0;text-align:center;}
.subtitle{font-style:italic;font-size:1.15em;}
.author{margin-top:3em;font-size:1.1em;}
.copyright p{text-indent:0;text-align:left;font-size:.85em;margin:.6em 0;}
.sources p{text-indent:0;text-align:left;font-size:.9em;margin:.5em 0;word-wrap:break-word;}
nav ol{list-style:none;margin:1em 0;padding:0;}
nav li{margin:.5em 0;}
.cover{margin:0;padding:0;text-align:center;}
.cover svg{width:100%;height:100%;}
`;

export async function buildEpub(book: AssemblyBook): Promise<Uint8Array> {
  const zip = new JSZip();
  const language = book.language || 'en';
  const author = book.author || AUTHOR_PLACEHOLDER;
  const identifier = 'urn:uuid:' + crypto.randomUUID();
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml',
    '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n' +
    '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>\n</container>\n');
  zip.file('OEBPS/css/style.css', EPUB_CSS);

  const manifest: string[] = [];
  const spine: string[] = [];
  const navItems: Array<[string, string]> = [];
  const add = (id: string, href: string, content: string, navTitle = '', linear = true) => {
    zip.file('OEBPS/' + href, content);
    manifest.push('<item id="' + id + '" href="' + href + '" media-type="application/xhtml+xml"/>');
    spine.push('<itemref idref="' + id + '"' + (linear ? '' : ' linear="no"') + '/>');
    if (navTitle) navItems.push([href, navTitle]);
  };

  if (book.cover) {
    const extension = imageExtension(book.cover.mime);
    zip.file('OEBPS/images/cover.' + extension, book.cover.bytes);
    manifest.push('<item id="cover-image" href="images/cover.' + extension + '" media-type="' + xml(book.cover.mime) + '" properties="cover-image"/>');
    const titleLines = wrapWords(book.title, 18).slice(0, 5);
    const tspans = titleLines.map((line, index) => '<tspan x="400" dy="' + (index ? 78 : 0) + '">' + xml(line) + '</tspan>').join('');
    const bandHeight = 150 + titleLines.length * 78;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 800 1200" preserveAspectRatio="xMidYMid meet">' +
      '<image width="800" height="1200" preserveAspectRatio="xMidYMid slice" xlink:href="../images/cover.' + extension + '"/>' +
      '<rect x="0" y="90" width="800" height="' + bandHeight + '" fill="#000000" fill-opacity="0.55"/>' +
      '<text x="400" y="200" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="64" fill="#ffffff">' + tspans + '</text>' +
      '<rect x="0" y="1070" width="800" height="90" fill="#000000" fill-opacity="0.55"/>' +
      '<text x="400" y="1128" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="#ffffff">' + xml(author) + '</text>' +
      '</svg>';
    add('cover', 'text/cover.xhtml', xhtmlPage('Cover', '<div class="cover">' + svg + '</div>', language), '', true);
    manifest[manifest.length - 1] = manifest[manifest.length - 1].replace('/>', ' properties="svg"/>');
  }

  add('title', 'text/title.xhtml', xhtmlPage(book.title,
    '<div class="titlepage"><h1>' + xml(book.title) + '</h1>' +
    (book.subtitle ? '<p class="subtitle">' + xml(book.subtitle) + '</p>' : '') +
    '<p class="author">' + xml(author) + '</p></div>', language), 'Title Page');
  add('copyright', 'text/copyright.xhtml', xhtmlPage('Copyright',
    '<div class="copyright"><p>' + xml(book.title) + '</p><p>Copyright © ' + book.year + ' ' + xml(author) + '</p>' +
    '<p>All rights reserved. No part of this book may be reproduced without written permission, except for brief quotations in reviews.</p>' +
    '<p>ISBN: ' + xml(book.isbn || 'to be assigned') + '</p></div>', language), 'Copyright');

  for (const chapter of book.chapters) {
    const file = 'text/chapter-' + String(chapter.number).padStart(2, '0') + '.xhtml';
    add('chapter-' + chapter.number, file, xhtmlPage(chapter.title,
      '<p class="label">Chapter ' + chapter.number + '</p>\n<h1>' + xml(chapter.title) + '</h1>\n' +
      markdownToXhtml(stripLeadingHeading(chapter.markdown)), language), 'Chapter ' + chapter.number + ': ' + chapter.title);
  }
  if (book.sources.length) {
    add('sources', 'text/sources.xhtml', xhtmlPage('Sources',
      '<h1>Sources</h1>\n<div class="sources">' +
      book.sources.map((source, index) => '<p>' + (index + 1) + '. ' + xml(source.title) + ' <a href="' + xml(source.url) + '">' + xml(source.url) + '</a></p>').join('\n') +
      '</div>', language), 'Sources');
  }

  const navBody = '<nav epub:type="toc" id="toc"><h1>Contents</h1>\n<ol>\n' +
    navItems.map(([href, title]) => '<li><a href="' + href + '">' + xml(title) + '</a></li>').join('\n') + '\n</ol></nav>';
  zip.file('OEBPS/nav.xhtml', xhtmlPage('Contents', navBody, language).replace('../css/style.css', 'css/style.css'));
  manifest.push('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
  manifest.push('<item id="css" href="css/style.css" media-type="text/css"/>');
  manifest.push('<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>');

  zip.file('OEBPS/toc.ncx',
    '<?xml version="1.0" encoding="UTF-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">\n' +
    '<head><meta name="dtb:uid" content="' + identifier + '"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>\n' +
    '<docTitle><text>' + xml(book.title) + '</text></docTitle>\n<navMap>\n' +
    navItems.map(([href, title], index) => '<navPoint id="np-' + (index + 1) + '" playOrder="' + (index + 1) + '"><navLabel><text>' + xml(title) + '</text></navLabel><content src="' + href + '"/></navPoint>').join('\n') +
    '\n</navMap>\n</ncx>\n');

  zip.file('OEBPS/content.opf',
    '<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="' + xml(language) + '">\n' +
    '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
    '<dc:identifier id="book-id">' + identifier + '</dc:identifier>\n' +
    '<dc:title>' + xml(book.title) + '</dc:title>\n' +
    '<dc:language>' + xml(language) + '</dc:language>\n' +
    '<dc:creator>' + xml(author) + '</dc:creator>\n' +
    (book.description ? '<dc:description>' + xml(book.description) + '</dc:description>\n' : '') +
    '<meta property="dcterms:modified">' + modified + '</meta>\n' +
    (book.cover ? '<meta name="cover" content="cover-image"/>\n' : '') +
    '</metadata>\n<manifest>\n' + manifest.join('\n') + '\n</manifest>\n<spine toc="ncx">\n' + spine.join('\n') + '\n</spine>\n</package>\n');

  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 9 }, mimeType: 'application/epub+zip' });
}

export async function validateEpub(bytes: Uint8Array) {
  const problems: string[] = [];
  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files);
  if (names[0] !== 'mimetype') problems.push('mimetype is not the first entry');
  const mimetype = zip.file('mimetype') ? await zip.file('mimetype')!.async('string') : '';
  if (mimetype !== 'application/epub+zip') problems.push('mimetype content is wrong');
  if (!zip.file('META-INF/container.xml')) problems.push('container.xml is missing');
  const opf = zip.file('OEBPS/content.opf') ? await zip.file('OEBPS/content.opf')!.async('string') : '';
  if (!opf) problems.push('content.opf is missing');
  const hrefs = [...opf.matchAll(/<item [^>]*href="([^"]+)"/g)].map((match) => match[1]);
  for (const href of hrefs) if (!zip.file('OEBPS/' + href)) problems.push('manifest file missing: ' + href);
  const chapters = hrefs.filter((href) => /chapter-\d+\.xhtml$/.test(href)).length;
  if (!chapters) problems.push('no chapter files');
  if (!/properties="nav"/.test(opf)) problems.push('nav document not declared');
  return { ok: problems.length === 0, problems, files: names.length, chapters };
}

// ----------------------------------------------------------------- pdf
type Fonts = { regular: any; bold: any; italic: any; boldItalic: any };
type PageMeta = { kind: 'opener' | 'body' | 'front'; running: string };
type Seg = { text: string; font: any; width: number };
type Word = { parts: Seg[]; width: number };
const oneWord = (text: string, font: any, width: number): Word => ({ parts: [{ text, font, width }], width });

const TRIMS: Record<string, { width: number; height: number; inner: number; outer: number; top: number; bottom: number; body: number; leading: number }> = {
  '6x9': { width: 432, height: 648, inner: 57.6, outer: 43.2, top: 57.6, bottom: 61.2, body: 10.8, leading: 15.2 },
  '8.5x11': { width: 612, height: 792, inner: 75.6, outer: 61.2, top: 68.4, bottom: 72, body: 11.5, leading: 16.4 }
};

export async function buildPdf(
  book: AssemblyBook,
  options: { includeCover: boolean; fonts?: FontBytes | null; fontkit?: any }
): Promise<{ bytes: Uint8Array; pages: number; bodyPages: number; fontsEmbedded: boolean; coverIncluded: boolean; notes: string[] }> {
  const notes: string[] = [];
  const trim = TRIMS[book.trim] || TRIMS['6x9'];
  const doc = await PDFDocument.create();
  const author = book.author || AUTHOR_PLACEHOLDER;
  doc.setTitle(book.title);
  doc.setAuthor(author);
  doc.setSubject(book.description || book.subtitle || '');
  doc.setCreator('VisionWeaver Book Pipeline');
  doc.setProducer('VisionWeaver Book Pipeline (pdf-lib)');

  let fonts: Fonts;
  let fontsEmbedded = false;
  let glyphs: Set<number> | null = null;
  if (options.fonts && options.fontkit) {
    try {
      doc.registerFontkit(options.fontkit);
      fonts = {
        regular: await doc.embedFont(options.fonts.regular, { subset: true }),
        bold: await doc.embedFont(options.fonts.bold, { subset: true }),
        italic: await doc.embedFont(options.fonts.italic, { subset: true }),
        boldItalic: await doc.embedFont(options.fonts.boldItalic, { subset: true })
      };
      glyphs = new Set<number>(fonts.regular.getCharacterSet());
      fontsEmbedded = true;
    } catch (error) {
      notes.push('Custom font embedding failed (' + String((error as Error).message || error).slice(0, 120) + '); built-in fonts were used.');
      fonts = undefined as unknown as Fonts;
    }
  }
  if (!fontsEmbedded) {
    fonts = {
      regular: await doc.embedFont(StandardFonts.TimesRoman),
      bold: await doc.embedFont(StandardFonts.TimesRomanBold),
      italic: await doc.embedFont(StandardFonts.TimesRomanItalic),
      boldItalic: await doc.embedFont(StandardFonts.TimesRomanBoldItalic)
    };
  }
  fonts = fonts!;

  const supported = new Map<string, boolean>();
  const canDraw = (char: string) => {
    const known = supported.get(char);
    if (known !== undefined) return known;
    let ok = false;
    if (glyphs) ok = glyphs.has(char.codePointAt(0) || 0);
    else { try { fonts.regular.encodeText(char); ok = true; } catch (_) { ok = false; } }
    supported.set(char, ok);
    return ok;
  };
  const FALLBACK: Record<string, string> = {
    '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '--', '…': '...',
    '•': '*', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', '−': '-', '→': '->', '×': 'x'
  };
  const clean = (value: string) => {
    let out = '';
    for (const char of String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F​-‍﻿]/g, '')) {
      if (char === '\n' || char === '\t') { out += ' '; continue; }
      if (canDraw(char)) { out += char; continue; }
      const mapped = FALLBACK[char];
      if (mapped && [...mapped].every(canDraw)) { out += mapped; continue; }
      const stripped = char.normalize('NFKD').replace(/[̀-ͯ]/g, '');
      if (stripped && stripped !== char && [...stripped].every(canDraw)) { out += stripped; continue; }
      out += '?';
    }
    return out;
  };

  const ink = rgb(0.08, 0.08, 0.08);
  const soft = rgb(0.38, 0.38, 0.38);
  const pages: any[] = [];
  const meta: PageMeta[] = [];
  let page: any = null;
  let cursor = 0;
  let running = '';

  const isRecto = (bodyIndex: number) => bodyIndex % 2 === 0; // body page 1 is a right-hand page
  const leftMargin = (bodyIndex: number) => (isRecto(bodyIndex) ? trim.inner : trim.outer);
  const textWidth = trim.width - trim.inner - trim.outer;
  const newPage = (kind: PageMeta['kind']) => {
    page = doc.addPage([trim.width, trim.height]);
    pages.push(page);
    meta.push({ kind, running });
    cursor = trim.height - trim.top;
    return page;
  };
  const left = () => leftMargin(pages.length - 1);
  const ensure = (height: number) => { if (cursor - height < trim.bottom) newPage('body'); };
  const fontFor = (run: Run) => (run.bold && run.italic ? fonts.boldItalic : run.bold ? fonts.bold : run.italic ? fonts.italic : fonts.regular);

  const toWords = (runs: Run[], size: number, maxWidth: number): Word[] => {
    const words: Word[] = [];
    let glue = false; // the previous run ended in the middle of a word
    for (const run of runs) {
      const font = fontFor(run);
      const text = clean(run.text);
      if (!text) continue;
      const startsWithSpace = /^\s/.test(text);
      text.split(/\s+/).filter(Boolean).forEach((piece, index) => {
        const width = font.widthOfTextAtSize(piece, size);
        const last = words[words.length - 1];
        if (index === 0 && glue && !startsWithSpace && last && last.width + width <= maxWidth) {
          last.parts.push({ text: piece, font, width });
          last.width += width;
          return;
        }
        let rest = piece;
        let restWidth = width;
        while (restWidth > maxWidth && rest.length > 1) {
          let cut = rest.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut -= 1;
          const head = rest.slice(0, cut);
          words.push(oneWord(head, font, font.widthOfTextAtSize(head, size)));
          rest = rest.slice(cut);
          restWidth = font.widthOfTextAtSize(rest, size);
        }
        words.push(oneWord(rest, font, restWidth));
      });
      glue = !/\s$/.test(text);
    }
    return words;
  };

  const breakLines = (words: Word[], size: number, firstWidth: number, restWidth: number) => {
    const space = fonts.regular.widthOfTextAtSize(' ', size);
    const lines: Array<{ words: Word[]; width: number }> = [];
    let current: Word[] = [];
    let width = 0;
    for (const word of words) {
      const limit = lines.length === 0 ? firstWidth : restWidth;
      const added = current.length ? width + space + word.width : word.width;
      if (current.length && added > limit) { lines.push({ words: current, width }); current = [word]; width = word.width; }
      else { current.push(word); width = added; }
    }
    if (current.length) lines.push({ words: current, width });
    return { lines, space };
  };

  const drawLine = (line: { words: Word[]; width: number }, x: number, y: number, size: number, space: number, maxWidth: number, mode: 'left' | 'justify' | 'center', color = ink) => {
    let gap = space;
    let start = x;
    if (mode === 'center') start = x + (maxWidth - line.width) / 2;
    if (mode === 'justify' && line.words.length > 1) {
      const extra = (maxWidth - line.width) / (line.words.length - 1);
      if (extra > 0 && extra <= space * 2.2) gap = space + extra;
    }
    let position = start;
    for (const word of line.words) {
      let offset = position;
      for (const part of word.parts) {
        page.drawText(part.text, { x: offset, y, size, font: part.font, color });
        offset += part.width;
      }
      position += word.width + gap;
    }
  };

  const paragraph = (runs: Run[], settings: { size: number; leading: number; indent: number; inset: number; hanging: number; align: 'left' | 'justify' | 'center'; marker?: string }) => {
    const width = textWidth - settings.inset * 2 - settings.hanging;
    const words = toWords(runs, settings.size, width - Math.max(0, settings.indent));
    if (!words.length) return;
    const { lines, space } = breakLines(words, settings.size, width - settings.indent, width);
    lines.forEach((line, index) => {
      ensure(settings.leading);
      const x = left() + settings.inset + settings.hanging;
      cursor -= settings.leading;
      if (index === 0 && settings.marker) {
        page.drawText(clean(settings.marker), { x: left() + settings.inset, y: cursor, size: settings.size, font: fonts.regular, color: ink });
      }
      const last = index === lines.length - 1;
      const mode = settings.align === 'justify' && last ? 'left' : settings.align;
      drawLine(line, x + (index === 0 ? settings.indent : 0), cursor, settings.size, space, width - (index === 0 ? settings.indent : 0), mode);
    });
  };

  const centered = (text: string, font: any, size: number, leading: number, color = ink, maxWidth = textWidth) => {
    const words = clean(text).split(/\s+/).filter(Boolean).map((piece) => oneWord(piece, font, font.widthOfTextAtSize(piece, size)));
    const space = font.widthOfTextAtSize(' ', size);
    const lines: Array<{ words: Word[]; width: number }> = [];
    let current: Word[] = [];
    let width = 0;
    for (const word of words) {
      const added = current.length ? width + space + word.width : word.width;
      if (current.length && added > maxWidth) { lines.push({ words: current, width }); current = [word]; width = word.width; }
      else { current.push(word); width = added; }
    }
    if (current.length) lines.push({ words: current, width });
    for (const line of lines) {
      cursor -= leading;
      drawLine(line, left() + (textWidth - maxWidth) / 2, cursor, size, space, maxWidth, 'center', color);
    }
  };

  const renderBlocks = (markdown: string) => {
    const blocks = parseBlocks(markdown);
    let afterBreak = true;
    for (const block of blocks) {
      if (block.type === 'hr') {
        ensure(trim.leading * 3);
        cursor -= trim.leading * 0.6;
        centered('* * *', fonts.regular, trim.body, trim.leading, soft);
        cursor -= trim.leading * 0.6;
        afterBreak = true;
      } else if (block.type === 'h2') {
        ensure(trim.leading * 5);
        cursor -= trim.leading * 0.9;
        paragraph(block.runs.map((run) => ({ ...run, bold: true })), { size: trim.body + 2.6, leading: trim.leading + 3, indent: 0, inset: 0, hanging: 0, align: 'left' });
        cursor -= trim.leading * 0.3;
        afterBreak = true;
      } else if (block.type === 'h3') {
        ensure(trim.leading * 4);
        cursor -= trim.leading * 0.7;
        paragraph(block.runs.map((run) => ({ ...run, bold: true, italic: true })), { size: trim.body + 0.8, leading: trim.leading + 1, indent: 0, inset: 0, hanging: 0, align: 'left' });
        cursor -= trim.leading * 0.2;
        afterBreak = true;
      } else if (block.type === 'quote') {
        cursor -= trim.leading * 0.5;
        paragraph(block.runs.map((run) => ({ ...run, italic: !run.italic })), { size: trim.body, leading: trim.leading, indent: 0, inset: 18, hanging: 0, align: 'left' });
        cursor -= trim.leading * 0.5;
        afterBreak = true;
      } else if (block.type === 'li' || block.type === 'oli') {
        paragraph(block.runs, { size: trim.body, leading: trim.leading, indent: 0, inset: 8, hanging: block.type === 'oli' ? 20 : 13, align: 'left', marker: block.marker });
        afterBreak = false;
      } else {
        paragraph(block.runs, { size: trim.body, leading: trim.leading, indent: afterBreak ? 0 : 16, inset: 0, hanging: 0, align: 'justify' });
        afterBreak = false;
      }
    }
  };

  // ---- body: chapters first, so the contents page can show real page numbers
  const chapterStart: number[] = [];
  const opener = (label: string, title: string) => {
    running = title;
    newPage('opener');
    cursor = trim.height - trim.top - trim.height * 0.16;
    if (label) centered(label.toUpperCase(), fonts.regular, trim.body - 1.2, trim.leading, soft);
    cursor -= trim.leading * 0.4;
    centered(title, fonts.bold, trim.body + 9, trim.body + 14, ink, textWidth * 0.86);
    cursor -= trim.leading * 2.2;
  };
  for (const chapter of book.chapters) {
    opener('Chapter ' + chapter.number, chapter.title);
    chapterStart.push(pages.length);
    renderBlocks(stripLeadingHeading(chapter.markdown));
  }
  let sourcesStart = 0;
  if (book.sources.length) {
    opener('', 'Sources');
    sourcesStart = pages.length;
    book.sources.forEach((source, index) => {
      paragraph([{ text: source.title + ' ', bold: false, italic: false }, { text: source.url, bold: false, italic: true }],
        { size: trim.body - 1.4, leading: trim.leading - 1.8, indent: 0, inset: 0, hanging: 20, align: 'left', marker: (index + 1) + '.' });
      cursor -= 3;
    });
  }
  const bodyPages = pages.length;

  // running heads and page numbers
  pages.forEach((bodyPage, index) => {
    const info = meta[index];
    const number = String(index + 1);
    const numberWidth = fonts.regular.widthOfTextAtSize(number, 9);
    bodyPage.drawText(number, { x: (trim.width - numberWidth) / 2, y: trim.bottom - 26, size: 9, font: fonts.regular, color: soft });
    if (info.kind !== 'body') return;
    const head = clean(isRecto(index) ? info.running : book.title).toUpperCase().slice(0, 70);
    const headWidth = fonts.regular.widthOfTextAtSize(head, 7.6);
    bodyPage.drawText(head, { x: leftMargin(index) + (textWidth - headWidth) / 2, y: trim.height - trim.top + 20, size: 7.6, font: fonts.regular, color: soft });
  });

  // ---- front matter, inserted ahead of the body
  const front: any[] = [];
  const frontPage = () => {
    const created = doc.insertPage(front.length, [trim.width, trim.height]);
    front.push(created);
    page = created;
    cursor = trim.height - trim.top;
    return created;
  };
  const frontLeft = () => (trim.width - textWidth) / 2;
  const frontCentered = (text: string, font: any, size: number, leading: number, color = ink) => {
    const maxWidth = textWidth * 0.9;
    const space = font.widthOfTextAtSize(' ', size);
    const words = clean(text).split(/\s+/).filter(Boolean).map((piece) => oneWord(piece, font, font.widthOfTextAtSize(piece, size)));
    const lines: Array<{ words: Word[]; width: number }> = [];
    let current: Word[] = [];
    let width = 0;
    for (const word of words) {
      const added = current.length ? width + space + word.width : word.width;
      if (current.length && added > maxWidth) { lines.push({ words: current, width }); current = [word]; width = word.width; }
      else { current.push(word); width = added; }
    }
    if (current.length) lines.push({ words: current, width });
    for (const line of lines) {
      cursor -= leading;
      let position = (trim.width - line.width) / 2;
      for (const word of line.words) { page.drawText(word.parts[0].text, { x: position, y: cursor, size, font, color }); position += word.width + space; }
    }
  };

  let coverIncluded = false;
  if (options.includeCover && book.cover) {
    try {
      const mime = sniffImageMime(book.cover.bytes, book.cover.mime);
      if (!/png|jpe?g/i.test(mime)) throw new Error('cover image type ' + mime + ' cannot be placed in a PDF');
      const image = /png/i.test(mime) ? await doc.embedPng(book.cover.bytes) : await doc.embedJpg(book.cover.bytes);
      frontPage();
      const scale = Math.max(trim.width / image.width, trim.height / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      page.drawImage(image, { x: (trim.width - width) / 2, y: (trim.height - height) / 2, width, height });
      const white = rgb(1, 1, 1);
      const titleSize = trim.body + 17;
      const titleLines = Math.max(1, Math.ceil(fonts.bold.widthOfTextAtSize(clean(book.title), titleSize) / (textWidth * 0.9)) + 0);
      const band = 44 + titleLines * (titleSize + 6) + (book.subtitle ? 26 : 0);
      page.drawRectangle({ x: 0, y: trim.height - 56 - band, width: trim.width, height: band, color: rgb(0, 0, 0), opacity: 0.58 });
      cursor = trim.height - 56 - 14;
      frontCentered(book.title, fonts.bold, titleSize, titleSize + 6, white);
      if (book.subtitle) { cursor -= 4; frontCentered(book.subtitle, fonts.italic, trim.body + 3, trim.body + 8, white); }
      page.drawRectangle({ x: 0, y: 40, width: trim.width, height: 40, color: rgb(0, 0, 0), opacity: 0.58 });
      cursor = 40 + 40 - 8;
      frontCentered(author, fonts.regular, trim.body + 3, trim.body + 8, white);
      coverIncluded = true;
    } catch (error) {
      notes.push('Cover page skipped: ' + String((error as Error).message || error).slice(0, 140));
      if (front.length) { doc.removePage(0); front.pop(); }
    }
  }

  frontPage();
  cursor = trim.height - trim.top - trim.height * 0.2;
  frontCentered(book.title, fonts.bold, trim.body + 15, trim.body + 21);
  if (book.subtitle) { cursor -= 10; frontCentered(book.subtitle, fonts.italic, trim.body + 3.5, trim.body + 9); }
  cursor -= trim.height * 0.16;
  frontCentered(author, fonts.regular, trim.body + 3, trim.body + 8);

  frontPage();
  cursor = trim.bottom + 150;
  for (const line of [
    book.title,
    'Copyright © ' + book.year + ' ' + author,
    'All rights reserved. No part of this book may be reproduced without written permission, except for brief quotations in reviews.',
    'ISBN: ' + (book.isbn || 'to be assigned')
  ]) {
    const words = clean(line).split(/\s+/).filter(Boolean);
    let current = '';
    const flushLine = () => { if (current) { cursor -= 12.5; page.drawText(current, { x: frontLeft(), y: cursor, size: 8.6, font: fonts.regular, color: soft }); current = ''; } };
    for (const word of words) {
      const candidate = current ? current + ' ' + word : word;
      if (fonts.regular.widthOfTextAtSize(candidate, 8.6) > textWidth) { flushLine(); current = word; } else current = candidate;
    }
    flushLine();
    cursor -= 6;
  }

  const entries: Array<[string, number]> = book.chapters.map((chapter, index) => ['Chapter ' + chapter.number + ': ' + chapter.title, chapterStart[index]]);
  if (sourcesStart) entries.push(['Sources', sourcesStart]);
  const perPage = Math.max(8, Math.floor((trim.height - trim.top - trim.bottom - 90) / 19));
  for (let offset = 0; offset < entries.length; offset += perPage) {
    frontPage();
    cursor = trim.height - trim.top - 20;
    if (offset === 0) { frontCentered('Contents', fonts.bold, trim.body + 7, trim.body + 12); cursor -= 22; }
    for (const [label, number] of entries.slice(offset, offset + perPage)) {
      cursor -= 19;
      const numberText = String(number);
      const numberWidth = fonts.regular.widthOfTextAtSize(numberText, trim.body);
      let text = clean(label);
      while (text.length > 4 && fonts.regular.widthOfTextAtSize(text, trim.body) > textWidth - numberWidth - 18) text = text.slice(0, -2);
      if (text !== clean(label)) text = text.replace(/\s+\S*$/, '') + '…';
      text = clean(text);
      page.drawText(text, { x: frontLeft(), y: cursor, size: trim.body, font: fonts.regular, color: ink });
      page.drawText(numberText, { x: frontLeft() + textWidth - numberWidth, y: cursor, size: trim.body, font: fonts.regular, color: ink });
    }
  }
  if (front.length % 2 === 1) frontPage(); // keep body page 1 on a right-hand page

  const bytes = await doc.save();
  return { bytes, pages: doc.getPageCount(), bodyPages, fontsEmbedded, coverIncluded, notes };
}

export async function validatePdf(bytes: Uint8Array) {
  const loaded = await PDFDocument.load(bytes);
  const pages = loaded.getPageCount();
  const first = pages ? loaded.getPage(0).getSize() : { width: 0, height: 0 };
  return { ok: pages > 0, pages, width_pt: first.width, height_pt: first.height, title: loaded.getTitle() || '' };
}
