import { sharedStringsFromXml, sheetXmlToRows } from "@/lib/people";

/**
 * Read the first sheet of an .xlsx file in the browser.
 *
 * An .xlsx is a zip of XML files. The zip is read here directly and its
 * pieces inflated with the browser's own decompressor, so importing a
 * spreadsheet doesn't add a library to the app — and the file never leaves
 * the admin's computer except as the rows that are saved.
 */
async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("That file isn't a readable .xlsx.");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!/^xl\/(sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml)$/.test(name)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + size);
    if (method === 0) files.set(name, raw);
    else if (method === 8) {
      const stream = new Response(raw).body!.pipeThrough(new DecompressionStream("deflate-raw"));
      files.set(name, new Uint8Array(await new Response(stream).arrayBuffer()));
    }
  }
  return files;
}

export async function readFirstSheet(file: File): Promise<(string | null)[][]> {
  const files = await unzip(new Uint8Array(await file.arrayBuffer()));
  const text = (name: string) => (files.has(name) ? new TextDecoder().decode(files.get(name)) : null);
  const shared = sharedStringsFromXml(text("xl/sharedStrings.xml") ?? "<sst/>");

  // The first sheet in the workbook's own order, not the first file in the zip.
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = text("xl/workbook.xml");
  const rels = text("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const firstId = /<sheet\b[^>]*r:id="([^"]+)"/.exec(wb)?.[1];
    const target = firstId && new RegExp(`Id="${firstId}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${firstId}"`).exec(rels);
    const t = target && (target[1] ?? target[2]);
    if (t) sheetPath = t.startsWith("/") ? t.slice(1) : `xl/${t}`;
  }
  const sheet = text(sheetPath);
  if (!sheet) throw new Error("Couldn't find a sheet in that file.");
  return sheetXmlToRows(sheet, shared);
}
