import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Inspection } from '../types';
import { getInspectionImageUrl } from '../api/client';

interface InspectionPdfData {
  inspection: Inspection;
  kksNumber: string;
  material?: string;
  diameter?: string;
}

// Helper to get status text
function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    approved: 'Godkendt',
    conditional: 'Betinget godkendt',
    rejected: 'Afvist',
    pending: 'Afventer',
  };
  return texts[status] || status;
}

// Helper to get checklist status text
function getChecklistStatusText(status: string): string {
  const texts: Record<string, string> = {
    ok: 'OK',
    '1': '1',
    '2': '2',
    '3': '3',
    na: 'N/A',
  };
  return texts[status] || status;
}

// Load image as base64
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateInspectionPdf(data: InspectionPdfData): Promise<void> {
  const { inspection, kksNumber, material, diameter } = data;
  const doc = new jsPDF('p', 'mm', 'a4');

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  // Colors
  const primaryColor: [number, number, number] = [37, 99, 235]; // Blue
  const headerBg: [number, number, number] = [241, 245, 249]; // Light gray
  const textColor: [number, number, number] = [15, 23, 42]; // Dark
  const mutedColor: [number, number, number] = [100, 116, 139]; // Muted

  // Helper to add new page if needed
  const checkPageBreak = (neededHeight: number) => {
    if (yPos + neededHeight > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // ===== HEADER =====
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Inspektionsrapport', margin, 18);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Rapport: ${inspection.reportNumber || 'Ikke angivet'}`, margin, 28);

  // KKS badge
  doc.setFillColor(255, 255, 255);
  const kksText = `KKS: ${kksNumber}`;
  const kksWidth = doc.getTextWidth(kksText) + 10;
  doc.roundedRect(pageWidth - margin - kksWidth, 12, kksWidth, 10, 2, 2, 'F');
  doc.setTextColor(...primaryColor);
  doc.text(kksText, pageWidth - margin - kksWidth + 5, 19);

  yPos = 45;

  // ===== GENERAL INFO BOX =====
  doc.setFillColor(...headerBg);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 50, 3, 3, 'F');

  doc.setTextColor(...textColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Generel information', margin + 5, yPos + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const col1X = margin + 5;
  const col2X = pageWidth / 2;
  let infoY = yPos + 16;

  // Column 1
  doc.setTextColor(...mutedColor);
  doc.text('Inspektionsdato:', col1X, infoY);
  doc.setTextColor(...textColor);
  doc.text(new Date(inspection.inspectionDate).toLocaleDateString('da-DK'), col1X + 35, infoY);

  infoY += 7;
  doc.setTextColor(...mutedColor);
  doc.text('Næste inspektion:', col1X, infoY);
  doc.setTextColor(...textColor);
  doc.text(inspection.nextInspectionDate ? new Date(inspection.nextInspectionDate).toLocaleDateString('da-DK') : 'Ikke angivet', col1X + 35, infoY);

  infoY += 7;
  doc.setTextColor(...mutedColor);
  doc.text('Materiale:', col1X, infoY);
  doc.setTextColor(...textColor);
  doc.text(material || 'Ikke angivet', col1X + 35, infoY);

  infoY += 7;
  doc.setTextColor(...mutedColor);
  doc.text('Diameter:', col1X, infoY);
  doc.setTextColor(...textColor);
  doc.text(diameter || 'Ikke angivet', col1X + 35, infoY);

  // Column 2
  infoY = yPos + 16;
  doc.setTextColor(...mutedColor);
  doc.text('Inspektør:', col2X, infoY);
  doc.setTextColor(...textColor);
  doc.text(`${inspection.inspectorName}${inspection.inspectorCert ? ` (${inspection.inspectorCert})` : ''}`, col2X + 25, infoY);

  infoY += 7;
  doc.setTextColor(...mutedColor);
  doc.text('Godkender:', col2X, infoY);
  doc.setTextColor(...textColor);
  doc.text(inspection.approverName ? `${inspection.approverName}${inspection.approverCert ? ` (${inspection.approverCert})` : ''}` : 'Ikke angivet', col2X + 25, infoY);

  infoY += 7;
  doc.setTextColor(...mutedColor);
  doc.text('Status:', col2X, infoY);

  // Status with color
  const statusText = getStatusText(inspection.overallStatus);
  const statusColors: Record<string, [number, number, number]> = {
    approved: [22, 163, 74],
    conditional: [202, 138, 4],
    rejected: [220, 38, 38],
    pending: [100, 116, 139],
  };
  doc.setTextColor(...(statusColors[inspection.overallStatus] || mutedColor));
  doc.setFont('helvetica', 'bold');
  doc.text(statusText, col2X + 25, infoY);
  doc.setFont('helvetica', 'normal');

  yPos += 58;

  // ===== CONCLUSION =====
  if (inspection.conclusion) {
    checkPageBreak(30);

    doc.setTextColor(...textColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Konklusion', margin, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const conclusionLines = doc.splitTextToSize(inspection.conclusion, pageWidth - 2 * margin);
    doc.text(conclusionLines, margin, yPos);
    yPos += conclusionLines.length * 4 + 8;
  }

  // ===== CHECKLIST =====
  if (inspection.checklist && inspection.checklist.length > 0) {
    checkPageBreak(40);

    doc.setTextColor(...textColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Inspektionscheckliste', margin, yPos);
    yPos += 4;

    const checklistData = inspection.checklist.map(item => [
      item.itemNumber.toString(),
      item.itemName,
      getChecklistStatusText(item.status),
      item.comment || '',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Punkt', 'Status', 'Kommentar']],
      body: checklistData,
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: textColor,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 55 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 'auto' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didParseCell: (data) => {
        // Color status cells
        if (data.column.index === 2 && data.section === 'body') {
          const status = inspection.checklist?.[data.row.index]?.status;
          if (status === 'ok') {
            data.cell.styles.textColor = [22, 163, 74];
            data.cell.styles.fontStyle = 'bold';
          } else if (status === '3') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (status === '2') {
            data.cell.styles.textColor = [202, 138, 4];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // ===== TML MEASUREMENTS =====
  if (inspection.tmlMeasurements && inspection.tmlMeasurements.length > 0) {
    checkPageBreak(40);

    doc.setTextColor(...textColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TML-målinger (Tykkelsesmålinger)', margin, yPos);
    yPos += 4;

    const tmlData = inspection.tmlMeasurements.map(tml => [
      tml.tmlNumber.toString(),
      tml.objectType || '-',
      tml.dimension || '-',
      tml.tNom?.toFixed(1) || '-',
      tml.tRet?.toFixed(1) || '-',
      tml.tAlert?.toFixed(1) || '-',
      tml.tMeasured?.toFixed(1) || '-',
      tml.position || '-',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['TML#', 'Type', 'Dim.', 'T.nom', 'T.ret', 'T.alert', 'T.målt', 'Position']],
      body: tmlData,
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
      },
      bodyStyles: {
        fontSize: 7,
        textColor: textColor,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 25 },
        2: { cellWidth: 20 },
        3: { cellWidth: 18 },
        4: { cellWidth: 18 },
        5: { cellWidth: 18 },
        6: { cellWidth: 18 },
        7: { cellWidth: 'auto' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didParseCell: (data) => {
        // Highlight measurements below alert threshold
        if (data.column.index === 6 && data.section === 'body') {
          const tml = inspection.tmlMeasurements?.[data.row.index];
          if (tml?.tMeasured && tml?.tAlert && tml.tMeasured < tml.tAlert) {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [254, 226, 226];
          }
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // ===== IMAGES =====
  if (inspection.images && inspection.images.length > 0) {
    checkPageBreak(60);

    doc.setTextColor(...textColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Billeddokumentation', margin, yPos);
    yPos += 8;

    const imagesPerRow = 2;
    const imageWidth = (pageWidth - 2 * margin - 10) / imagesPerRow;
    const imageHeight = 50;
    let xPos = margin;
    let imagesInRow = 0;

    for (const image of inspection.images) {
      if (checkPageBreak(imageHeight + 15)) {
        xPos = margin;
        imagesInRow = 0;
      }

      // Load and add image
      const imageUrl = getInspectionImageUrl(image.filename);
      const base64 = await loadImageAsBase64(imageUrl);

      if (base64) {
        try {
          doc.addImage(base64, 'JPEG', xPos, yPos, imageWidth, imageHeight, undefined, 'MEDIUM');
        } catch {
          // If image fails, draw placeholder
          doc.setFillColor(...headerBg);
          doc.rect(xPos, yPos, imageWidth, imageHeight, 'F');
          doc.setFontSize(8);
          doc.setTextColor(...mutedColor);
          doc.text('Billede kunne ikke indlæses', xPos + imageWidth / 2, yPos + imageHeight / 2, { align: 'center' });
        }
      }

      // Image caption
      doc.setFontSize(7);
      doc.setTextColor(...mutedColor);
      const caption = `#${image.imageNumber || '-'}: ${image.originalName}`;
      doc.text(caption, xPos, yPos + imageHeight + 4, { maxWidth: imageWidth });

      imagesInRow++;
      if (imagesInRow >= imagesPerRow) {
        xPos = margin;
        yPos += imageHeight + 12;
        imagesInRow = 0;
      } else {
        xPos += imageWidth + 10;
      }
    }

    if (imagesInRow > 0) {
      yPos += imageHeight + 12;
    }
  }

  // ===== FOOTER =====
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer line
    doc.setDrawColor(...headerBg);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

    // Footer text
    doc.setFontSize(7);
    doc.setTextColor(...mutedColor);
    doc.text(`Genereret: ${new Date().toLocaleDateString('da-DK')} ${new Date().toLocaleTimeString('da-DK')}`, margin, pageHeight - 10);
    doc.text(`Side ${i} af ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  // Save the PDF
  const filename = `Inspektion_${kksNumber}_${inspection.inspectionDate}.pdf`;
  doc.save(filename);
}
