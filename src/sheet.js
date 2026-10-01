import fs from 'node:fs';
import ExcelJS from 'exceljs';

export const COLUMNS = [
  { header: 'Business', key: 'name', width: 34 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Phone', key: 'phone', width: 18 },
  { header: 'WhatsApp?', key: 'whatsapp', width: 11 },
  { header: 'WhatsApp link', key: 'whatsappLink', width: 26 },
  { header: 'Social page', key: 'socialLink', width: 30 },
  { header: 'Address', key: 'address', width: 45 },
  { header: 'Rating', key: 'rating', width: 8 },
  { header: 'Reviews', key: 'reviews', width: 9 },
  { header: 'Google Maps', key: 'mapsUrl', width: 30 },
  { header: 'Search', key: 'search', width: 30 },
  { header: 'Found on', key: 'foundOn', width: 11 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Notes', key: 'notes', width: 30 },
  { header: 'Place ID', key: 'placeId', width: 30 },
];

const LINK_KEYS = new Set(['whatsappLink', 'socialLink', 'mapsUrl']);

// Reads Place IDs already in the sheet so repeat runs only add new businesses.
export async function existingPlaceIds(file) {
  if (!fs.existsSync(file)) return new Set();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet('Leads');
  const ids = new Set();
  if (!ws) return ids;
  const col = headerIndex(ws, 'Place ID');
  if (!col) return ids;
  ws.eachRow((row, n) => {
    if (n > 1) ids.add(String(cellText(row.getCell(col).value)));
  });
  return ids;
}

function headerIndex(ws, name) {
  let idx = 0;
  ws.getRow(1).eachCell((cell, n) => {
    if (cell.value === name) idx = n;
  });
  return idx;
}

function cellText(v) {
  if (v && typeof v === 'object') return v.text ?? v.hyperlink ?? '';
  return v ?? '';
}

// Appends leads to the workbook (creating it if needed), keeping user edits to existing rows.
export async function appendLeads(file, leads) {
  const wb = new ExcelJS.Workbook();
  if (fs.existsSync(file)) await wb.xlsx.readFile(file);
  let ws = wb.getWorksheet('Leads');
  if (!ws) {
    ws = wb.addWorksheet('Leads', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.addRow(COLUMNS.map((c) => c.header));
    ws.getRow(1).font = { bold: true };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };
  }
  COLUMNS.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width;
  });

  for (const lead of leads) {
    const row = ws.addRow(
      COLUMNS.map(({ key }) => {
        const v = lead[key] ?? '';
        return LINK_KEYS.has(key) && v ? { text: v, hyperlink: v } : v;
      }),
    );
    COLUMNS.forEach(({ key }, i) => {
      if (LINK_KEYS.has(key) && lead[key]) row.getCell(i + 1).font = { color: { argb: 'FF1155CC' }, underline: true };
    });
  }

  await wb.xlsx.writeFile(file);
}
