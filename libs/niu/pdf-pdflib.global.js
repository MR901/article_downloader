// PDF-lib based PDF generation for ArticleDoc
// This replaces jsPDF to eliminate security warnings

class PDFLibAdapter {
  constructor() {
    this.pdfLib = null;
    this.doc = null;
    this.currentPage = null;
    this.pages = [];
    this.fontSize = 12;
    this.fontFamily = 'Helvetica';
    this.textColor = [0, 0, 0];
    this.currentY = 0;
    this.pageHeight = 842; // A4 height in points
    this.pageWidth = 595;  // A4 width in points
    this.margin = 56;      // Standard margin
    this.lineHeight = 16;  // Default line height
  }

  async initialize() {
    if (!this.pdfLib) {
      // Load PDF-lib dynamically
      await this.loadPDFLib();
    }

    // Create new document
    this.doc = await this.pdfLib.PDFDocument.create();
    this.currentPage = this.doc.addPage([this.pageWidth, this.pageHeight]);
    this.currentY = this.margin;
  }

  async loadPDFLib() {
    if (typeof window !== 'undefined' && window.pdfLib) {
      this.pdfLib = window.pdfLib;
      return;
    }

    // For now, we'll need to load PDF-lib via script tag
    // This is similar to the jsPDF loading approach
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'libs/pdf-lib.min.js';
      script.onload = () => {
        this.pdfLib = window.pdfLib;
        resolve();
      };
      script.onerror = (e) => reject(new Error('Failed to load PDF-lib'));
      document.head.appendChild(script);
    });
  }

  setFont(family, style = 'normal') {
    this.fontFamily = family;
    // PDF-lib handles font embedding differently
  }

  setFontSize(size) {
    this.fontSize = size;
  }

  setTextColor(r, g, b) {
    this.textColor = [r, g, b];
  }

  text(text, x, y) {
    // This is a simplified implementation
    // In a full implementation, we'd need to:
    // 1. Embed fonts
    // 2. Handle text layout and wrapping
    // 3. Manage positioning

    if (this.currentY > this.pageHeight - this.margin) {
      this.addPage();
    }

    // For now, this is a placeholder
    // A full implementation would need to use PDF-lib's text drawing capabilities
    this.currentY += this.lineHeight;
  }

  addPage() {
    this.currentPage = this.doc.addPage([this.pageWidth, this.pageHeight]);
    this.currentY = this.margin;
  }

  addImage(imageData, format, x, y, width, height) {
    // PDF-lib supports image embedding
    // This would need to be implemented based on PDF-lib's image API
  }

  async save() {
    const pdfBytes = await this.doc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }

  // Additional methods would need to be implemented for:
  // - getTextWidth()
  // - link()
  // - textWithLink()
  // - internal.getCurrentPageInfo()
  // - outline support
  // - etc.
}

// Export for use in popup.js
window.PDFLibAdapter = PDFLibAdapter;
