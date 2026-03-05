import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

/**
 * Adds the branded Gymz header to a PDF document
 * @param doc The jsPDF document instance
 * @param title The title of the report
 * @param subtitle Optional subtitle or extra info
 * @returns The Y-coordinate where the content should start
 */
export async function addBrandedHeader(doc: jsPDF, title: string, subtitle?: string): Promise<number> {
    const pageWidth = doc.internal.pageSize.getWidth();

    // 1. Draw Header Background (Gymz Green)
    doc.setFillColor(42, 75, 42); // #2A4B2A
    doc.rect(0, 0, pageWidth, 40, 'F');

    // 2. Add Title & Subtitle
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text(title.toUpperCase(), 15, 20); // Moved up to make room for subtitle

    doc.setFontSize(10);
    if (subtitle) {
        doc.text(subtitle, 15, 28);
    }

    doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 15, 34);

    // 3. Load and Add Logo
    try {
        const base = typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/";
        const logoUrl = `${base}gymzLogo.png`;
        const logoBase64 = await loadLogo(logoUrl);
        if (logoBase64) {
            // Add logo to top right (512x512 square)
            const logoWidth = 30;
            const logoHeight = 30;
            doc.addImage(logoBase64, 'PNG', pageWidth - 45, 5, logoWidth, logoHeight);
        }
    } catch (error) {
        console.warn('Failed to load logo for PDF:', error);
    }

    // Return safe start Y position for content
    return 50;
}

/**
 * Helper to load an image from a URL and converting to Base64
 */
function loadLogo(url: string): Promise<string | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = url;
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(null);
                return;
            }
            ctx.drawImage(img, 0, 0);
            try {
                const dataURL = canvas.toDataURL('image/png');
                resolve(dataURL);
            } catch (e) {
                resolve(null);
            }
        };

        img.onerror = () => {
            resolve(null);
        };
    });
}
