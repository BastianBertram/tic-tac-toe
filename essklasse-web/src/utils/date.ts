import { format, parseISO, isValid, type Locale } from 'date-fns';

/**
 * Formatiert ein ISO-Datum (YYYY-MM-DD) sicher.
 * Bei leerem oder ungültigem Wert wird '' zurückgegeben statt einen
 * "Invalid time value"-Fehler beim Rendern auszulösen.
 */
export function formatDatum(
  dateStr: string | undefined | null,
  fmt = 'dd.MM.yyyy',
  opts?: { locale?: Locale },
): string {
  if (!dateStr) return '';
  const d = parseISO(dateStr);
  return isValid(d) ? format(d, fmt, opts) : '';
}
