import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import crypto from "crypto";

export interface SignatureAuditEntry {
  role: "Bailleur" | "Locataire";
  name: string;
  email: string;
  ip: string;
  signedAt: Date;
  userAgent?: string;
}

export interface StampOptions {
  documentLabel: string;
  referenceId: string;
  auditEntries: SignatureAuditEntry[];
  documentHash: string;
}

export function hashPdfBuffer(buf: Buffer | Uint8Array): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function formatDate(d: Date): string {
  return d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}

export async function stampPdf(originalBytes: Uint8Array, opts: StampOptions): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const page = pdfDoc.addPage([595, 842]); // A4
  const { width } = page.getSize();
  const margin = 48;
  const contentWidth = width - margin * 2;

  let y = 800;

  const drawText = (text: string, x: number, yPos: number, size: number, f = font, color = rgb(0.1, 0.1, 0.1)) => {
    page.drawText(text, { x, y: yPos, size, font: f, color });
  };

  const drawLine = (yPos: number) => {
    page.drawLine({
      start: { x: margin, y: yPos },
      end: { x: margin + contentWidth, y: yPos },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
  };

  // En-tête violet
  page.drawRectangle({ x: 0, y: 790, width, height: 52, color: rgb(0.388, 0.357, 1) });
  drawText("CERTIFICAT DE SIGNATURE ÉLECTRONIQUE", margin, 810, 13, fontBold, rgb(1, 1, 1));
  drawText("lokt.fr — Signature électronique simple (eIDAS Art. 3(10))", margin, 796, 8, font, rgb(0.85, 0.85, 1));

  y = 765;
  drawText("Document signé", margin, y, 8, font, rgb(0.5, 0.5, 0.5));
  y -= 14;
  drawText(opts.documentLabel, margin, y, 11, fontBold);

  y -= 22;
  drawLine(y);
  y -= 18;

  drawText("Référence lokt.fr", margin, y, 8, font, rgb(0.5, 0.5, 0.5));
  drawText("Hash SHA-256 du document original", margin + contentWidth / 2, y, 8, font, rgb(0.5, 0.5, 0.5));
  y -= 13;
  drawText(`SIG-${opts.referenceId.toUpperCase().slice(0, 12)}`, margin, y, 9, fontMono);
  // Hash sur deux lignes (trop long)
  const h = opts.documentHash;
  drawText(h.slice(0, 32), margin + contentWidth / 2, y, 7, fontMono);
  y -= 10;
  drawText(h.slice(32), margin + contentWidth / 2, y, 7, fontMono);

  y -= 22;
  drawLine(y);
  y -= 20;

  drawText("SIGNATURES RECUEILLIES", margin, y, 9, fontBold, rgb(0.388, 0.357, 1));
  y -= 20;

  for (const entry of opts.auditEntries) {
    // Fond léger par entrée
    page.drawRectangle({
      x: margin - 8,
      y: y - 52,
      width: contentWidth + 16,
      height: 64,
      color: rgb(0.97, 0.97, 1),
      borderColor: rgb(0.82, 0.80, 1),
      borderWidth: 0.5,
      borderOpacity: 1,
      opacity: 1,
    });

    // Puce verte (cercle plein)
    page.drawCircle({ x: margin + 8, y: y - 10, size: 8, color: rgb(0.18, 0.72, 0.42) });
    drawText("OK", margin + 2, y - 14, 5.5, fontBold, rgb(1, 1, 1));

    drawText(entry.role, margin + 24, y - 4, 9, fontBold, rgb(0.18, 0.72, 0.42));
    y -= 18;
    drawText(`${entry.name} — ${entry.email}`, margin + 24, y, 9, font);
    y -= 13;
    drawText(`Signé le ${formatDate(entry.signedAt)}`, margin + 24, y, 8, font, rgb(0.4, 0.4, 0.4));
    y -= 11;
    drawText(`Adresse IP : ${entry.ip}`, margin + 24, y, 7, fontMono, rgb(0.5, 0.5, 0.5));
    y -= 24;
  }

  drawLine(y);
  y -= 16;

  drawText(
    "Ce certificat atteste que les parties ont consenti à la signature de ce document par voie électronique.",
    margin, y, 7.5, font, rgb(0.4, 0.4, 0.4)
  );
  y -= 12;
  drawText(
    "Règlement eIDAS (UE) n°910/2014 — Signature électronique simple — Article 3(10).",
    margin, y, 7.5, font, rgb(0.4, 0.4, 0.4)
  );
  y -= 12;
  drawText(
    "Émis par lokt.fr — lokt.fr — contact@lokt.fr",
    margin, y, 7.5, font, rgb(0.4, 0.4, 0.4)
  );

  return pdfDoc.save();
}
