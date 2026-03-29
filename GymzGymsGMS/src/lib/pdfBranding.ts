import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches the gym name from the database for use in PDF reports.
 * @param gymId The gym ID from the current user's context
 * @returns The gym name, or "Gym" as fallback if not found
 */
export async function fetchGymNameForReport(gymId: string | null | undefined): Promise<string> {
  if (!gymId) return 'Gym';
  const { data } = await supabase
    .from('gyms')
    .select('name')
    .eq('id', gymId)
    .maybeSingle();
  return data?.name || 'Gym';
}

/**
 * Adds a gym-branded header to a PDF document.
 * The gym name is the primary identity; "Powered by Gymz AI" appears as very subtle attribution.
 *
 * @param doc The jsPDF document instance
 * @param gymName The name of the gym (dynamically sourced from gym profile)
 * @param title The report title (e.g., "Finance Report", "Member Registry")
 * @param subtitle Optional subtitle or extra info
 * @param generatedBy Optional admin name who generated the report
 * @returns The Y-coordinate where the content should start
 */
export function addBrandedHeader(
  doc: jsPDF,
  gymName: string,
  title: string,
  subtitle?: string,
  generatedBy?: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. Draw Header Background (Gymz Green)
  doc.setFillColor(42, 75, 42); // #2A4B2A
  doc.rect(0, 0, pageWidth, 45, 'F');

  // 2. Gym Name (primary, prominent)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont(undefined, 'bold');
  doc.text(gymName, 15, 18);

  // 3. "Powered by Gymz AI" (very subtle - small font, muted color)
  doc.setFontSize(6);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(150, 170, 150);
  doc.text('Powered by Gymz AI', 15, 23);

  // 4. Report Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text(title.toUpperCase(), 15, 32);

  // 5. Subtitle (if provided)
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  if (subtitle) {
    doc.text(subtitle, 15, 38);
  }

  // 6. Generated timestamp and admin
  const genLine = generatedBy
    ? `Generated: ${format(new Date(), 'PPP p')} by ${generatedBy}`
    : `Generated: ${format(new Date(), 'PPP p')}`;
  doc.text(genLine, 15, subtitle ? 42 : 38);

  // Return safe start Y position for content
  return 52;
}
