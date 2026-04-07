import { SupabaseClient } from '@supabase/supabase-js';
import { ExportFilters, ExportType, PhoneCategory, Language } from '../types';

// ============================================
// Export Handler Utility
// ============================================
// Handles CSV/Excel exports with proper UTF-8 encoding
// Ensures Arabic/Kurdish text doesn't get distorted

/**
 * Export records to CSV format with UTF-8 BOM
 * This prevents Excel from distorting Arabic/Kurdish text
 */
export async function exportToCSV(
  supabase: SupabaseClient,
  filters: ExportFilters
): Promise<{ csv: string; count: number; filename: string }> {
  // Fetch records
  const records = await fetchRecordsForExport(supabase, filters);

  if (records.length === 0) {
    throw new Error('No records found matching the specified filters');
  }

  // Transform records for export
  const exportData = records.map(record => ({
    'Name (English)': record.name || '',
    'Name (Arabic)': record.name_ar || '',
    'Name (Kurdish)': record.name_ku || '',
    'Phone': record.phone || '',
    'Has Phone': record.has_phone ? 'Yes' : 'No',
    'Phone Category': record.phone_category || '',
    'WhatsApp': record.whatsapp || '',
    'Category': record.category || '',
    'Governorate': record.governorate || '',
    'City': record.city || '',
    'Address': record.address || '',
    'Language': record.language || '',
    'Sources': (record.sources || []).join(', '),
    'Source URLs': (record.source_urls || []).join(', '),
    'Confidence': record.confidence_final || 0,
    'Verified Via': (record.verified_via || []).join(', '),
    'Pushed At': record.pushed_at || '',
  }));

  // Generate CSV
  const csv = generateCSV(exportData);

  // Add UTF-8 BOM for Excel compatibility
  const bom = '\uFEFF';
  const csvWithBom = bom + csv;

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0];
  const filterDesc = generateFilterDescription(filters);
  const filename = `iraq-compass-${filterDesc}-${timestamp}.csv`;

  // Log export
  await logExport(supabase, 'csv', filters, records.length);

  return { csv: csvWithBom, count: records.length, filename };
}

/**
 * Export records to Excel format (XLSX)
 * Uses proper encoding for Arabic/Kurdish support
 */
export async function exportToExcel(
  supabase: SupabaseClient,
  filters: ExportFilters
): Promise<{ data: Uint8Array; count: number; filename: string }> {
  // Fetch records
  const records = await fetchRecordsForExport(supabase, filters);

  if (records.length === 0) {
    throw new Error('No records found matching the specified filters');
  }

  // Transform records
  const exportData = records.map(record => ({
    name_en: record.name || '',
    name_ar: record.name_ar || '',
    name_ku: record.name_ku || '',
    phone: record.phone || '',
    has_phone: record.has_phone ? 'Yes' : 'No',
    phone_category: record.phone_category || '',
    whatsapp: record.whatsapp || '',
    category: record.category || '',
    governorate: record.governorate || '',
    city: record.city || '',
    address: record.address || '',
    language: record.language || '',
    sources: (record.sources || []).join(', '),
    confidence: record.confidence_final || 0,
    verified_via: (record.verified_via || []).join(', '),
    pushed_at: record.pushed_at || '',
  }));

  // Generate Excel (simple XML-based format)
  // In production, use a library like xlsx or exceljs
  const excelData = generateSimpleExcel(exportData);

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0];
  const filterDesc = generateFilterDescription(filters);
  const filename = `iraq-compass-${filterDesc}-${timestamp}.xlsx`;

  // Log export
  await logExport(supabase, 'excel', filters, records.length);

  return { data: excelData, count: records.length, filename };
}

/**
 * Fetch records from production table with filters
 */
async function fetchRecordsForExport(
  supabase: SupabaseClient,
  filters: ExportFilters
): Promise<Record<string, unknown>[]> {
  let query = supabase
    .from('business_records_production')
    .select('*');

  // Apply filters
  if (filters.governorate) {
    query = query.eq('governorate', filters.governorate);
  }

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  if (filters.phone_category) {
    query = query.eq('phone_category', filters.phone_category);
  }

  if (filters.language) {
    query = query.eq('language', filters.language);
  }

  if (filters.city) {
    query = query.eq('city', filters.city);
  }

  // Order by name for consistent output
  query = query.order('name', { ascending: true });

  // Fetch all matching records
  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch records: ${error.message}`);
  }

  return data || [];
}

/**
 * Generate CSV from data array
 */
function generateCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);

  // Escape and format values
  const escapeValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);

    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  // Build CSV
  const lines: string[] = [];

  // Header row
  lines.push(headers.join(','));

  // Data rows
  for (const row of data) {
    const values = headers.map(h => escapeValue(row[h]));
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

/**
 * Generate simple Excel XML format
 * Note: In production, use a proper library like xlsx
 */
function generateSimpleExcel(data: Record<string, unknown>[]): Uint8Array {
  // This is a simplified Excel XML generation
  // For production, install and use 'xlsx' package

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Businesses">
    <Table>
      ${generateExcelRows(data)}
    </Table>
  </Worksheet>
</Workbook>`;

  // Convert to Uint8Array with UTF-8 encoding
  const encoder = new TextEncoder();
  return encoder.encode(xml);
}

function generateExcelRows(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);

  let rows = '<Row>\n';
  for (const header of headers) {
    rows += `        <Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>\n`;
  }
  rows += '      </Row>\n';

  for (const row of data) {
    rows += '      <Row>\n';
    for (const header of headers) {
      const value = row[header];
      const type = typeof value === 'number' ? 'Number' : 'String';
      rows += `        <Cell><Data ss:Type="${type}">${escapeXml(String(value || ''))}</Data></Cell>\n`;
    }
    rows += '      </Row>\n';
  }

  return rows;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate filter description for filename
 */
function generateFilterDescription(filters: ExportFilters): string {
  const parts: string[] = [];

  if (filters.governorate) {
    parts.push(filters.governorate.toLowerCase().replace(/\s+/g, '-'));
  }

  if (filters.category) {
    parts.push(filters.category.toLowerCase().replace(/\s+/g, '-'));
  }

  if (filters.phone_category) {
    parts.push(filters.phone_category);
  }

  if (filters.language) {
    parts.push(filters.language);
  }

  if (parts.length === 0) {
    return 'all';
  }

  return parts.join('-');
}

/**
 * Log export to database
 */
async function logExport(
  supabase: SupabaseClient,
  type: ExportType,
  filters: ExportFilters,
  count: number
): Promise<void> {
  try {
    await supabase.from('export_logs').insert({
      export_type: type,
      filters: filters,
      record_count: count,
      encoding: 'utf8',
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Non-critical error, just log
    console.error('[ExportHandler] Failed to log export:', err);
  }
}

/**
 * Get available filter options
 */
export async function getFilterOptions(
  supabase: SupabaseClient
): Promise<{
  governorates: string[];
  categories: string[];
  cities: string[];
  phoneCategories: PhoneCategory[];
  languages: Language[];
}> {
  // Fetch distinct values from production table
  const [govResult, catResult, cityResult] = await Promise.all([
    supabase.from('business_records_production').select('governorate'),
    supabase.from('business_records_production').select('category'),
    supabase.from('business_records_production').select('city'),
  ]);

  const governorates = [...new Set((govResult.data || []).map(r => r.governorate).filter(Boolean))];
  const categories = [...new Set((catResult.data || []).map(r => r.category).filter(Boolean))];
  const cities = [...new Set((cityResult.data || []).map(r => r.city).filter(Boolean))];

  return {
    governorates: governorates.sort(),
    categories: categories.sort(),
    cities: cities.sort(),
    phoneCategories: ['whatsapp_only', 'phone_only', 'both', 'none'],
    languages: ['ar', 'ku', 'en'],
  };
}

/**
 * Validate export filters
 */
export function validateFilters(filters: ExportFilters): string[] {
  const errors: string[] = [];

  // Add validation as needed
  if (filters.language && !['ar', 'ku', 'en'].includes(filters.language)) {
    errors.push('Invalid language filter');
  }

  if (filters.phone_category && !['whatsapp_only', 'phone_only', 'both', 'none'].includes(filters.phone_category)) {
    errors.push('Invalid phone category filter');
  }

  return errors;
}
