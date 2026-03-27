import jsPDF from 'jspdf';
import 'jspdf-autotable';

function formatDKK(amount) {
  return new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' kr.';
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function generateTilbudPDF(offer, company) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { tilbud, jobbeskrivelse, tilbudsnummer, oprettetDato } = offer;
  const kunde = tilbud?.kunde ?? jobbeskrivelse?.kunde ?? {};

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  // ── Header ──────────────────────────────────────────────────────
  doc.setFillColor(27, 79, 114); // aison blue
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('TILBUD', margin, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nr: ${tilbudsnummer}`, margin, 28);
  doc.text(`Dato: ${formatDate(oprettetDato)}`, margin + 50, 28);

  // ── Company info (right side of header) ─────────────────────────
  doc.setFontSize(9);
  const companyLines = [
    company.navn,
    company.adresse,
    `${company.postnr} ${company.by}`.trim(),
    `CVR: ${company.cvr}`,
    company.telefon,
    company.email,
  ].filter(Boolean);

  let rightY = 10;
  companyLines.forEach(line => {
    doc.text(line, pageWidth - margin, rightY, { align: 'right' });
    rightY += 4.5;
  });

  // ── Customer block ───────────────────────────────────────────────
  doc.setTextColor(0, 0, 0);
  let y = 45;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Til:', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 5;

  const kundeLines = [
    kunde.navn,
    kunde.adresse,
    `${kunde.postnr ?? ''} ${kunde.by ?? ''}`.trim(),
    kunde.telefon,
    kunde.email,
  ].filter(Boolean);
  kundeLines.forEach(line => {
    doc.text(line, margin, y);
    y += 5;
  });

  // ── Job title & description ──────────────────────────────────────
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(jobbeskrivelse?.titel ?? 'Tilbud', margin, y);
  y += 6;

  if (jobbeskrivelse?.beskrivelse) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(jobbeskrivelse.beskrivelse, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 5;
  }

  if (jobbeskrivelse?.adresse) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(`Arbejdssted: ${jobbeskrivelse.adresse}`, margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
  }

  // ── Line items table ─────────────────────────────────────────────
  const linjer = tilbud?.linjer ?? [];

  const subtotalArbejd = linjer.filter(l => l.type === 'arbejdsløn').reduce((s, l) => s + l.beloeb, 0);
  const subtotalMat = linjer.filter(l => l.type === 'materialer').reduce((s, l) => s + l.beloeb, 0);
  const subtotalAnden = linjer.filter(l => l.type !== 'arbejdsløn' && l.type !== 'materialer').reduce((s, l) => s + l.beloeb, 0);
  const subtotal = linjer.reduce((s, l) => s + l.beloeb, 0);
  const moms = subtotal * 0.25;
  const total = subtotal + moms;

  const typeLabel = (type) => {
    if (type === 'arbejdsløn') return 'Arbejdsløn';
    if (type === 'materialer') return 'Materialer';
    return 'Udlæg/Andet';
  };

  doc.autoTable({
    startY: y,
    head: [['Beskrivelse', 'Antal', 'Enhed', 'Enhedspris', 'Beløb']],
    body: linjer.map(l => [
      `${typeLabel(l.type)}: ${l.beskrivelse}`,
      String(l.antal),
      l.enhed,
      formatDKK(l.enhedspris),
      formatDKK(l.beloeb),
    ]),
    foot: [
      ['', '', '', 'Subtotal ekskl. moms', formatDKK(subtotal)],
      ['', '', '', 'Moms 25%', formatDKK(moms)],
      ['', '', '', 'Total inkl. moms', formatDKK(total)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [27, 79, 114], fontSize: 9, fontStyle: 'bold' },
    footStyles: { fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 85 },
      1: { cellWidth: 15, halign: 'right' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 8;

  // ── Notes & terms ────────────────────────────────────────────────
  if (tilbud?.noter) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Bemærkninger:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(tilbud.noter, pageWidth - margin * 2);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4.5 + 5;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const gyldig = tilbud?.gyldighedsdage ?? 30;
  doc.text(`Tilbuddet er gyldigt i ${gyldig} dage fra ovenstående dato.`, margin, y);
  y += 5;
  doc.text(`Betalingsbetingelser: ${tilbud?.betalingsbetingelser ?? 'Netto 14 dage'}`, margin, y);
  y += 5;

  if (tilbud?.forbehold) {
    const forbeholdLines = doc.splitTextToSize(`Forbehold: ${tilbud.forbehold}`, pageWidth - margin * 2);
    doc.text(forbeholdLines, margin, y);
    y += forbeholdLines.length * 4.5 + 5;
  }

  // ── Signature ────────────────────────────────────────────────────
  y = Math.max(y, doc.internal.pageSize.getHeight() - 50);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.text('Venlig hilsen', margin, y);
  y += 12;
  doc.line(margin, y, margin + 60, y);
  y += 4;
  doc.text(company.navn, margin, y);

  // ── Footer ───────────────────────────────────────────────────────
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(27, 79, 114);
  doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text(
    `${company.navn} · CVR ${company.cvr} · ${company.adresse}, ${company.postnr} ${company.by} · ${company.telefon} · ${company.email}`,
    pageWidth / 2,
    pageHeight - 4,
    { align: 'center' }
  );

  return doc;
}

export function downloadTilbudPDF(offer, company) {
  const doc = generateTilbudPDF(offer, company);
  doc.save(`tilbud-${offer.tilbudsnummer}.pdf`);
}
