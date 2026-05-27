import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanRichText(text: string | null | undefined): string {
  if (!text) return '';
  // Simple check to see if it looks like HTML
  if (text.includes('<') && text.includes('>')) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return doc.body.textContent || "";
  }
  return text;
}

export function isValidUUID(uuid: any): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  if (uuid === 'null' || uuid === 'undefined') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
