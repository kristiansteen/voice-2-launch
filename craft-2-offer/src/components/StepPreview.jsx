import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function StepPreview({ data, onBack }) {
  const { company, client, items, meta } = data;

  const fmt = (n) =>
    Number(n).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.unitPrice) || 0) * (parseFloat(i.qty) || 0), 0);
  const vat = subtotal * 0.25;
  const total = subtotal + vat;

  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + (meta.validDays || 30));
  const fmtDate = (d) => d.toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const generatePDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const primary = [27, 79, 114];   // #1B4F72
    const light = [46, 134, 193];    // #2E86C1
    const gray = [120, 120, 120];
    const W = 210;

    // Header bar
    doc.setFillColor(...primary);
    doc.rect(0, 0, W, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('TILBUD', 14, 13);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (meta.offerNumber) doc.text(`Nr. ${meta.offerNumber}`, 14, 20);
    doc.text(`Dato: ${fmtDate(today)}     Gyldigt til: ${fmtDate(validUntil)}`, W - 14, 13, { align: 'right' });

    // Company block
    doc.setTextColor(...primary);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(company.name || '', 14, 38);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    const compLines = [company.address, company.city, company.cvr ? `CVR: ${company.cvr}` : null, company.email, company.phone]
      .filter(Boolean);
    doc.text(compLines, 14, 44);

    // Client block
    doc.setTextColor(...primary);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('TILBUD TIL', W / 2 + 5, 35);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.text(client.name || '', W / 2 + 5, 41);
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    const clientLines = [client.attention, client.address, client.city, client.email].filter(Boolean);
    doc.text(clientLines, W / 2 + 5, 47);

    // Items table
    autoTable(doc, {
      startY: 75,
      head: [['Beskrivelse', 'Antal', 'Enhed', 'Enhedspris', 'Beløb']],
      body: items.map((i) => [
        i.description,
        String(i.qty),
        i.unit,
        `${fmt(i.unitPrice)} kr.`,
        `${fmt((parseFloat(i.unitPrice) || 0) * (parseFloat(i.qty) || 0))} kr.`,
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: primary, textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 80 }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      alternateRowStyles: { fillColor: [245, 248, 252] },
    });

    // Totals
    const afterTable = doc.lastAutoTable.finalY + 6;
    const col = W - 70;
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.text('Subtotal:', col, afterTable); doc.text(`${fmt(subtotal)} kr.`, W - 14, afterTable, { align: 'right' });
    doc.text('Moms 25%:', col, afterTable + 6); doc.text(`${fmt(vat)} kr.`, W - 14, afterTable + 6, { align: 'right' });
    doc.setDrawColor(...light);
    doc.line(col, afterTable + 9, W - 14, afterTable + 9);
    doc.setFontSize(11);
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.text('I alt:', col, afterTable + 15); doc.text(`${fmt(total)} kr.`, W - 14, afterTable + 15, { align: 'right' });

    // Notes
    if (meta.notes) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...gray);
      doc.text('Bemærkninger:', 14, afterTable + 6);
      doc.text(doc.splitTextToSize(meta.notes, 90), 14, afterTable + 12);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(`Genereret med Aison  •  ${company.email || ''}`, W / 2, 290, { align: 'center' });

    doc.save(`tilbud-${meta.offerNumber || fmtDate(today)}.pdf`);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-aison mb-1">Klar til download</h2>
      <p className="text-sm text-gray-400 mb-6">Gennemse oplysningerne og hent dit tilbud som PDF</p>

      {/* Summary card */}
      <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-3 mb-6">
        <div className="flex justify-between">
          <span className="text-gray-400">Fra</span>
          <span className="font-medium text-right">
            {company.name}<br />
            <span className="text-gray-400 font-normal">{company.email}</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Til</span>
          <span className="font-medium text-right">
            {client.name}
            {client.attention && <><br /><span className="text-gray-400 font-normal">{client.attention}</span></>}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Linjer</span>
          <span className="font-medium">{items.length}</span>
        </div>
        <div className="border-t border-gray-200 pt-2 flex justify-between">
          <span className="text-gray-400">I alt inkl. moms</span>
          <span className="font-bold text-aison text-base">
            {fmt(total)} kr.
          </span>
        </div>
        {meta.validDays && (
          <div className="flex justify-between text-xs text-gray-400">
            <span>Gyldigt i</span><span>{meta.validDays} dage</span>
          </div>
        )}
      </div>

      <button
        onClick={generatePDF}
        className="w-full py-3 rounded-xl bg-aison text-white font-semibold text-base hover:bg-aison-light transition-colors"
      >
        Download PDF
      </button>

      <div className="mt-4 flex justify-start">
        <button className="btn-secondary" onClick={onBack}>← Ret oplysninger</button>
      </div>
    </div>
  );
}
