import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export async function generateClinicalReport(history: any[]) {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(2, 6, 23); // navy-950
    doc.text("ClinicalDDI Interaction Report", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text("Privacy Note: This report was generated locally on-device.", 14, 35);
    
    // Table
    const tableData = history.map(item => [
        new Date(item.timestamp).toLocaleDateString(),
        `${item.drug1} + ${item.drug2}`,
        item.severity.toUpperCase(),
        `${(item.confidence * 100).toFixed(1)}%`,
        item.notes || "-"
    ]);
    
    autoTable(doc, {
        startY: 45,
        head: [['Date', 'Drug Pair', 'Severity', 'Confidence', 'Notes']],
        body: tableData,
        headStyles: { fillColor: [99, 102, 241] }, // brand-500
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 45 },
    });
    
    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
            "Disclaimer: For clinical decision support only. Not a substitute for professional medical advice.",
            14, 
            doc.internal.pageSize.height - 10
        );
    }
    
    doc.save(`ClinicalDDI_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}
