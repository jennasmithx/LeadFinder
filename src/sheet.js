import ExcelJS from 'exceljs';

export const COLUMNS = [
  { header: 'Business', key: 'name', width: 34 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Phone', key: 'phone', width: 18 },
  { header: 'WhatsApp?', key: 'whatsapp', width: 11 },
  { header: 'WhatsApp link', key: 'whatsappLink', width: 26 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Notes', key: 'notes', width: 30 },
  { header: 'Rating', key: 'rating', width: 8 },
  { header: 'Reviews', key: 'reviews', width: 9 },
  { header: 'Address', key: 'address', width: 45 },
  { header: 'Google Maps', key: 'mapsUrl', width: 30 },
  { header: 'Social page', key: 'socialLink', width: 30 },
  { header: 'Search', key: 'search', width: 30 },
  { header: 'Found on', key: 'foundOn', width: 11 },
  { header: 'Place ID', key: 'placeId', width: 30 },
];

const LINK_KEYS = new Set(['whatsappLink', 'socialLink', 'mapsUrl']);

// Builds leads.xlsx from the saved leads and returns it as a Buffer.
export async function buildWorkbook(leads) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Leads', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLUMNS.map(({ header, key, width }) => ({ header, key, width }));
  ws.getRow(1).font = { bold: true };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  for (const lead of leads) {
    const row = ws.addRow(
      Object.fromEntries(
        COLUMNS.map(({ key }) => {
          const v = lead[key] ?? '';
          return [key, LINK_KEYS.has(key) && v ? { text: v, hyperlink: v } : v];
        }),
      ),
    );
    COLUMNS.forEach(({ key }, i) => {
      if (LINK_KEYS.has(key) && lead[key]) row.getCell(i + 1).font = { color: { argb: 'FF1155CC' }, underline: true };
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
