import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanRichText(val: any): string {
  if (val === null || val === undefined) return '';
  
  let data = val;
  // If it's a string that looks like JSON, try to parse it
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        data = JSON.parse(trimmed);
      } catch (e) {
        // Not JSON, continue with original string
      }
    }
  }

  // If it's an object with a richText property (standard ExcelJS/importer format)
  if (typeof data === 'object' && data.richText && Array.isArray(data.richText)) {
    return data.richText.map((rt: any) => rt.text || '').join('');
  }
  
  // If it's an array (sometimes rich text is stored as a direct array of fragments)
  if (Array.isArray(data)) {
    return data.map((rt: any) => (typeof rt === 'string' ? rt : (rt.text || ''))).join('');
  }

  // If we couldn't parse it special, return stringified version if it's still an object
  // (but avoid [object Object] if possible)
  if (typeof data === 'object') {
    return val === data ? JSON.stringify(val) : String(val);
  }

  return String(data);
}

export function isValidUUID(uuid: any): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  if (uuid === 'null' || uuid === 'undefined') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
