/**
 * Generate a professional PDF quote for Star Truck Equipment.
 * Uses jsPDF to build the document client-side.
 */
import jsPDF from "jspdf";
import { LOGO_BASE64 } from "./logoBase64";

export interface QuotePdfItem {
  activity: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface Salesperson {
  name: string;
  phone: string;
  email: string;
}

export const SALESPEOPLE: Salesperson[] = [
  { name: "Jon Cochrum", phone: "979-453-1745", email: "jon.cochrum@trailerplace.com" },
  { name: "Craig Gingles", phone: "346-459-0083", email: "craig.gingles@trailerplace.com" },
  { name: "George Silvas", phone: "979-533-0488", email: "george.silvas@startruckequipment.com" },
  { name: "Justin Juarez", phone: "713-997-0997", email: "justin.juarez@startruckequipment.com" },
];

export interface QuotePdfOptions {
  estimateNumber: string;
  date: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  items: QuotePdfItem[];
  subtotal: number;
  taxRate: number; // 0.0675 for 6.75%
  taxEnabled: boolean;
  total: number;
  truckLabel?: string;
  salesperson?: Salesperson;
  notes?: string;
}

const DARK = "#1e1e1e";
const GRAY = "#555555";
const LIGHT_GRAY = "#999999";
const ACCENT = "#c41e1e"; // Star red
const LINE_COLOR = "#d0d0d0";
const TABLE_HEADER_BG = "#f5f5f5";

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtCurrency(n: number): string {
  const neg = n < 0;
  const abs = Math.abs(n);
  return neg ? `-$${fmt(abs)}` : `$${fmt(abs)}`;
}

export function generateQuotePdf(opts: QuotePdfOptions): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 50;
  const rightEdge = pageW - margin;
  let y = margin;

  const tax = opts.taxEnabled ? opts.subtotal * opts.taxRate : 0;
  const total = opts.subtotal + tax;

  // ─── Logo (top-left) ───
  try {
    doc.addImage(LOGO_BASE64, "JPEG", margin, y - 10, 150, 75);
  } catch {
    // Fallback text logo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(DARK);
    doc.text("STAR", margin, y + 20);
    doc.setFontSize(9);
    doc.text("TRUCK EQUIPMENT", margin, y + 32);
  }

  // ─── Company Info (right-aligned) ───
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(DARK);
  doc.text("Star Truck Equipment", rightEdge, y, { align: "right" });
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(GRAY);
  doc.text("2507 CR 231", rightEdge, y, { align: "right" });
  y += 11;
  doc.text("Wharton, TX  77488", rightEdge, y, { align: "right" });
  y += 11;
  doc.text("www.startruckequipment.com", rightEdge, y, { align: "right" });

  // Salesperson info below company
  if (opts.salesperson) {
    y += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(DARK);
    doc.text(opts.salesperson.name, rightEdge, y, { align: "right" });
    y += 11;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(GRAY);
    doc.text(opts.salesperson.phone, rightEdge, y, { align: "right" });
    y += 11;
    doc.text(opts.salesperson.email, rightEdge, y, { align: "right" });
  }

  y = margin + 90;

  // ─── Accent line ───
  doc.setDrawColor(ACCENT);
  doc.setLineWidth(2);
  doc.line(margin, y, rightEdge, y);
  y += 20;

  // ─── "Estimate" Title ───
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(DARK);
  doc.text("Estimate", margin, y);
  y += 30;

  // ─── Address & Estimate Info row ───
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(LIGHT_GRAY);
  doc.text("ADDRESS", margin, y);
  doc.text("ESTIMATE #", rightEdge - 130, y);
  doc.text("DATE", rightEdge - 50, y);
  y += 14;

  doc.setFontSize(10);
  doc.setTextColor(DARK);
  doc.setFont("helvetica", "bold");
  doc.text(opts.estimateNumber, rightEdge - 130, y);
  doc.text(opts.date, rightEdge - 50, y);

  doc.setFont("helvetica", "normal");
  if (opts.customerName) {
    doc.setFont("helvetica", "bold");
    doc.text(opts.customerName, margin, y);
    doc.setFont("helvetica", "normal");
    y += 14;
    if (opts.customerPhone) {
      doc.setFontSize(9);
      doc.setTextColor(GRAY);
      doc.text(opts.customerPhone, margin, y);
      y += 12;
    }
    if (opts.customerEmail) {
      doc.setFontSize(9);
      doc.setTextColor(GRAY);
      doc.text(opts.customerEmail, margin, y);
      y += 12;
    }
    if (opts.customerAddress) {
      doc.setFontSize(10);
      doc.setTextColor(DARK);
      const addrLines = opts.customerAddress.split("\n");
      for (const line of addrLines) {
        doc.text(line, margin, y);
        y += 13;
      }
    }
  }

  y += 10;

  // ─── Truck info (if present) ───
  if (opts.truckLabel) {
    doc.setFillColor("#f0f4f8");
    doc.roundedRect(margin, y, rightEdge - margin, 22, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(DARK);
    doc.text(`Vehicle: ${opts.truckLabel}`, margin + 10, y + 14);
    y += 32;
  }

  y += 6;

  // ─── Table Header ───
  const colActivity = margin;
  const colDesc = margin + 110;
  const colQty = rightEdge - 150;
  const colRate = rightEdge - 80;
  const colAmt = rightEdge;

  // Header background
  doc.setFillColor(TABLE_HEADER_BG);
  doc.rect(margin, y - 10, rightEdge - margin, 18, "F");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(GRAY);
  doc.text("ACTIVITY", colActivity + 6, y + 2);
  doc.text("DESCRIPTION", colDesc, y + 2);
  doc.text("QTY", colQty, y + 2, { align: "right" });
  doc.text("RATE", colRate, y + 2, { align: "right" });
  doc.text("AMOUNT", colAmt, y + 2, { align: "right" });
  y += 14;
  doc.setDrawColor(LINE_COLOR);
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightEdge, y);
  y += 14;

  // ─── Table Rows ───
  doc.setTextColor(DARK);
  doc.setFontSize(9);
  for (const item of opts.items) {
    // Check if we need a new page
    if (y > pageH - 160) {
      doc.addPage();
      y = margin;
    }

    doc.setFont("helvetica", "normal");
    // Activity
    const actLines = doc.splitTextToSize(item.activity, 100);
    doc.text(actLines, colActivity + 6, y);
    // Description (may be multi-line)
    const descLines = doc.splitTextToSize(item.description, 190);
    doc.text(descLines, colDesc, y);
    // QTY
    doc.text(String(item.qty), colQty, y, { align: "right" });
    // Rate
    doc.text(fmt(item.rate), colRate, y, { align: "right" });
    // Amount
    doc.setFont("helvetica", "bold");
    doc.text(fmt(item.amount), colAmt, y, { align: "right" });
    doc.setFont("helvetica", "normal");

    const rowHeight = Math.max(descLines.length * 12, actLines.length * 12, 16);
    y += rowHeight + 6;

    // Light row separator
    doc.setDrawColor("#e8e8e8");
    doc.setLineWidth(0.3);
    doc.line(margin, y, rightEdge, y);
    y += 10;
  }

  y += 8;

  // ─── Totals ───
  const totalsX = rightEdge - 180;

  doc.setDrawColor(LINE_COLOR);
  doc.setLineWidth(0.5);
  doc.line(totalsX, y, rightEdge, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(GRAY);
  doc.text("SUBTOTAL", colRate, y, { align: "right" });
  doc.setTextColor(DARK);
  doc.text(fmt(opts.subtotal), colAmt, y, { align: "right" });
  y += 18;

  if (opts.taxEnabled) {
    doc.setTextColor(GRAY);
    doc.text(`TAX (${(opts.taxRate * 100).toFixed(2)}%)`, colRate, y, { align: "right" });
    doc.setTextColor(DARK);
    doc.text(fmt(tax), colAmt, y, { align: "right" });
  } else {
    doc.setTextColor(GRAY);
    doc.text("TAX", colRate, y, { align: "right" });
    doc.setTextColor(DARK);
    doc.text("0.00", colAmt, y, { align: "right" });
  }
  y += 6;

  doc.setDrawColor(LINE_COLOR);
  doc.setLineWidth(0.5);
  doc.line(totalsX, y, rightEdge, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(DARK);
  doc.text("TOTAL", colRate, y, { align: "right" });
  doc.text(fmtCurrency(total), colAmt, y, { align: "right" });

  y += 50;

  // ─── Signature lines ───
  if (y < pageH - 120) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(GRAY);

    doc.text("Accepted By", margin, y);
    doc.setDrawColor(LINE_COLOR);
    doc.setLineWidth(0.5);
    doc.line(margin + 70, y + 2, margin + 280, y + 2);
    y += 24;

    doc.text("Accepted Date", margin, y);
    doc.line(margin + 80, y + 2, margin + 280, y + 2);
  }

  // ─── Footer ───
  const footerY = pageH - 40;

  // Red accent line
  doc.setDrawColor(ACCENT);
  doc.setLineWidth(1);
  doc.line(margin, footerY - 12, rightEdge, footerY - 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(LIGHT_GRAY);
  doc.text(
    "*After 7 working days, all deleted truck beds will accrue storage charges at the rate of $10/day.",
    pageW / 2,
    footerY,
    { align: "center" }
  );
  doc.text(
    "Star Truck Equipment — www.startruckequipment.com",
    pageW / 2,
    footerY + 12,
    { align: "center" }
  );

  return doc;
}
