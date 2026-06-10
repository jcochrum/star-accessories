import { useQuery } from "convex/react";
import { ExternalLink, Phone, Mail, CheckCircle2, CreditCard, Calendar, Clock, AlertCircle, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "../../convex/_generated/api";
import { useState, useEffect, useCallback } from "react";

const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL || "https://modest-albatross-638.convex.site";
const DEPOSIT_AMOUNT = 500;

function formatPrice(price: number) {
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatScheduledDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/* ─── Install date picker ─── */
function InstallDatePicker({
  selectedDate,
  onSelect,
  busyDatesRaw,
}: {
  selectedDate: string | null;
  onSelect: (date: string) => void;
  busyDatesRaw: string | null | undefined;
}) {
  const busyDates: Set<string> = new Set();
  if (busyDatesRaw) {
    try {
      const parsed = JSON.parse(busyDatesRaw);
      if (Array.isArray(parsed)) {
        for (const d of parsed) busyDates.add(d);
      }
    } catch { /* ignore */ }
  }

  const today = new Date();
  const dates: { date: string; display: string; dayName: string }[] = [];
  const cursor = new Date(today);
  cursor.setDate(cursor.getDate() + 3);
  while (cursor.getDay() === 0 || cursor.getDay() === 6) cursor.setDate(cursor.getDate() + 1);

  for (let i = 0; i < 30 && dates.length < 15; i++) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      const iso = cursor.toISOString().split("T")[0];
      if (!busyDates.has(iso)) {
        dates.push({
          date: iso,
          display: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          dayName: cursor.toLocaleDateString("en-US", { weekday: "short" }),
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (dates.length === 0) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800 font-medium">No install dates available in the next few weeks.</p>
        <p className="text-xs text-amber-700 mt-1">Please call us at (979) 532-1486 to schedule.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <Calendar className="size-4" />
        Select preferred install date
      </p>
      <div className="grid grid-cols-3 gap-2">
        {dates.map((d) => (
          <button
            type="button"
            key={d.date}
            onClick={() => onSelect(d.date)}
            className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
              selectedDate === d.date
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
            }`}
          >
            <span className="block text-xs opacity-75">{d.dayName}</span>
            <span>{d.display}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Only available dates are shown. We'll confirm your install slot after deposit.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   QuoteViewPage — PDF / Invoice–style layout
   ═══════════════════════════════════════════════════════════════ */
export function QuoteViewPage({ slug }: { slug: string }) {
  const quote = useQuery(api.quotes.getBySlug, { slug }) as any;
  const depositInfo = useQuery(api.stripe.getDepositStatus, { slug });
  const busyDatesRaw = useQuery(api.settings.get, { key: "calendarBusyDates" });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  /* ── Stripe return handler ── */
  const verifyPayment = useCallback(async (sessionId: string) => {
    setVerifying(true);
    try {
      const res = await fetch(`${CONVEX_SITE_URL}/stripe/verify-session?session_id=${sessionId}`);
      const data = await res.json();
      if (data.paid) window.history.replaceState({}, "", `/quote/${slug}`);
    } catch (err) { console.error("Verify error:", err); }
    finally { setVerifying(false); }
  }, [slug]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const depositParam = params.get("deposit");
    const sessionId = params.get("session_id");
    if (depositParam === "success" && sessionId) verifyPayment(sessionId);
    else if (depositParam === "cancelled") {
      setError("Payment was cancelled. You can try again when you're ready.");
      window.history.replaceState({}, "", `/quote/${slug}`);
    }
  }, [slug, verifyPayment]);

  const handlePayDeposit = async () => {
    if (!selectedDate) { setError("Please select a preferred install date first."); return; }
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch(`${CONVEX_SITE_URL}/stripe/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, scheduledDate: selectedDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || "Failed to start checkout");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setIsProcessing(false);
    }
  };

  /* ── Loading / not found ── */
  if (quote === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 print:bg-white">
        <div className="text-center">
          <div className="size-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading quote…</p>
        </div>
      </div>
    );
  }
  if (quote === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-800">Quote Not Found</h2>
          <p className="text-gray-500 text-sm mt-1">This quote link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  /* ── Data ── */
  type LineItem = { unitPrice: number; quantity: number; installHours: number; brand: string; series: string; partNumber: string; category: string };
  const items: LineItem[] = quote.items ?? [];
  const laborRate: number = quote.laborRate ?? 0;
  const bedPrice: number = quote.inventoryPrice ?? 0;
  const truckMake: string | null = quote.truckMake ?? null;
  const truckConfig: string | null = quote.truckConfig ?? null;
  const inventoryUrl: string | null = quote.inventoryUrl ?? null;
  const inventoryTitle: string | null = quote.inventoryTitle ?? null;

  const partsTotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const installTotal = items.reduce((s, i) => s + i.installHours * laborRate * i.quantity, 0);
  const grandTotal = partsTotal + installTotal + bedPrice;

  const isDepositPaid = depositInfo?.depositStatus === "paid" || quote.depositStatus === "paid";

  /* ═══════════════════  RENDER  ═══════════════════ */
  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Print button — hidden in print */}
      <div className="print:hidden sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
        <div className="max-w-[850px] mx-auto px-6 py-2 flex items-center justify-between">
          <span className="text-sm text-gray-500">Quote {slug.toUpperCase()}</span>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4 mr-1.5" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* ── Invoice paper ── */}
      <div className="max-w-[850px] mx-auto my-6 print:my-0 bg-white shadow-lg print:shadow-none rounded-lg print:rounded-none overflow-hidden">

        {/* ═══ Header band ═══ */}
        <div className="bg-[#1a1a1a] text-white px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-2xl">★</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Star Truck Equipment</h1>
              <p className="text-sm text-white/60 mt-0.5">2507 County Rd 231 · Wharton, TX 77488</p>
              <p className="text-sm text-white/60">(979) 532-1486 · startruckequipment.com</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-wider">QUOTE</p>
            <p className="text-sm text-white/60 font-mono mt-1">{slug.toUpperCase()}</p>
          </div>
        </div>

        {/* ═══ Meta row ═══ */}
        <div className="px-8 py-5 border-b bg-gray-50 flex flex-wrap gap-x-10 gap-y-3 text-sm">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Date</p>
            <p className="font-medium text-gray-800">{formatDate(quote._creationTime)}</p>
          </div>
          {isDepositPaid && (
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Status</p>
              <Badge className="bg-green-100 text-green-800 text-xs font-semibold">Accepted</Badge>
            </div>
          )}
        </div>

        {/* ═══ Customer + Vehicle row ═══ */}
        <div className="px-8 py-5 border-b grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Customer */}
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Customer</p>
            {quote.customerName && (
              <p className="text-base font-semibold text-gray-900">{quote.customerName}</p>
            )}
            {quote.customerPhone && (
              <a href={`tel:${quote.customerPhone}`} className="flex items-center gap-1.5 text-sm text-gray-600 mt-1 hover:text-blue-600">
                <Phone className="size-3.5 text-gray-400" />
                {quote.customerPhone}
              </a>
            )}
            {quote.customerEmail && (
              <a href={`mailto:${quote.customerEmail}`} className="flex items-center gap-1.5 text-sm text-gray-600 mt-1 hover:text-blue-600">
                <Mail className="size-3.5 text-gray-400" />
                {quote.customerEmail}
              </a>
            )}
          </div>

          {/* Vehicle */}
          {(truckMake || inventoryUrl) && (
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Vehicle & Bed</p>
              {truckMake && (
                <p className="text-base font-semibold text-gray-900">
                  {truckMake}{truckConfig ? ` — ${truckConfig}` : ""}
                </p>
              )}
              {inventoryUrl && (
                <a href={inventoryUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline mt-1">
                  <ExternalLink className="size-3.5" />
                  {inventoryTitle || "View Bed / Body"}
                </a>
              )}
              {bedPrice > 0 && (
                <p className="text-sm font-semibold text-gray-800 mt-1">{formatPrice(bedPrice)}</p>
              )}
            </div>
          )}
        </div>

        {/* ═══ Deposit success banner ═══ */}
        {isDepositPaid && (
          <div className="mx-8 my-5 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3 print:border-green-300">
            <CheckCircle2 className="size-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900 text-sm">Deposit Received — Quote Accepted</p>
              <p className="text-xs text-green-800 mt-0.5">
                Your ${DEPOSIT_AMOUNT} transferable deposit has been received.
                {(depositInfo?.depositPaidAt || quote.depositPaidAt) && (
                  <span> Paid on {formatDate(depositInfo?.depositPaidAt || quote.depositPaidAt)}</span>
                )}
              </p>
              {(depositInfo?.scheduledDate || quote.scheduledDate) && (
                <p className="text-xs text-green-800 mt-1 flex items-center gap-1">
                  <Calendar className="size-3" />
                  Preferred install: {formatScheduledDate(depositInfo?.scheduledDate || quote.scheduledDate)}
                </p>
              )}
            </div>
          </div>
        )}

        {verifying && (
          <div className="mx-8 my-5 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
            <div className="size-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
            <p className="text-sm text-blue-800 font-medium">Verifying your payment…</p>
          </div>
        )}

        {/* ═══ Line items table ═══ */}
        <div className="px-8 py-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2.5 text-[11px] text-gray-500 uppercase tracking-wider font-semibold w-[5%]">#</th>
                <th className="text-left py-2.5 text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Description</th>
                <th className="text-center py-2.5 text-[11px] text-gray-500 uppercase tracking-wider font-semibold w-[8%]">Qty</th>
                <th className="text-right py-2.5 text-[11px] text-gray-500 uppercase tracking-wider font-semibold w-[15%]">Unit Price</th>
                <th className="text-right py-2.5 text-[11px] text-gray-500 uppercase tracking-wider font-semibold w-[15%]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {/* Bed / Body line (if present) */}
              {bedPrice > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="py-3 text-gray-400">1</td>
                  <td className="py-3">
                    <p className="font-medium text-gray-900">{inventoryTitle || "Truck Bed / Body"}</p>
                    <p className="text-xs text-gray-500">Bed / Body</p>
                  </td>
                  <td className="py-3 text-center text-gray-700">1</td>
                  <td className="py-3 text-right text-gray-700">{formatPrice(bedPrice)}</td>
                  <td className="py-3 text-right font-medium text-gray-900">{formatPrice(bedPrice)}</td>
                </tr>
              )}

              {/* Accessory lines */}
              {items.map((item, idx) => {
                const installCost = item.installHours * laborRate * item.quantity;
                const lineTotal = (item.unitPrice * item.quantity) + installCost;
                const unitInstalled = item.unitPrice + (item.installHours * laborRate);
                const lineNum = (bedPrice > 0 ? 2 : 1) + idx;
                return (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-3 text-gray-400">{lineNum}</td>
                    <td className="py-3">
                      <p className="font-medium text-gray-900">{item.brand} {item.series}</p>
                      <p className="text-xs text-gray-500">
                        {item.category}
                        {item.partNumber ? ` · ${item.partNumber}` : ""}
                        {item.installHours > 0 ? ` · Install incl.` : ""}
                      </p>
                    </td>
                    <td className="py-3 text-center text-gray-700">{item.quantity}</td>
                    <td className="py-3 text-right text-gray-700">{formatPrice(unitInstalled)}</td>
                    <td className="py-3 text-right font-medium text-gray-900">{formatPrice(lineTotal)}</td>
                  </tr>
                );
              })}

              {/* Empty rows for that invoice look if few items */}
              {items.length < 3 && Array.from({ length: 3 - items.length }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-b border-gray-100">
                  <td className="py-3">&nbsp;</td>
                  <td className="py-3"></td>
                  <td className="py-3"></td>
                  <td className="py-3"></td>
                  <td className="py-3"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ═══ Totals ═══ */}
        <div className="px-8 pb-6">
          <div className="flex justify-end">
            <div className="w-72">
              {bedPrice > 0 && (
                <div className="flex justify-between py-1.5 text-sm">
                  <span className="text-gray-500">Bed / Body</span>
                  <span className="text-gray-800">{formatPrice(bedPrice)}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 text-sm">
                <span className="text-gray-500">Parts & Accessories</span>
                <span className="text-gray-800">{formatPrice(partsTotal)}</span>
              </div>
              {installTotal > 0 && (
                <div className="flex justify-between py-1.5 text-sm">
                  <span className="text-gray-500">Installation</span>
                  <span className="text-gray-800">{formatPrice(installTotal)}</span>
                </div>
              )}
              <div className="border-t-2 border-gray-900 mt-2 pt-2 flex justify-between">
                <span className="text-base font-bold text-gray-900">Total</span>
                <span className="text-base font-bold text-gray-900">{formatPrice(grandTotal)}</span>
              </div>

              {isDepositPaid && (
                <>
                  <div className="flex justify-between py-1.5 text-sm text-green-700 mt-1">
                    <span>Deposit Paid</span>
                    <span>−{formatPrice(DEPOSIT_AMOUNT)}</span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 flex justify-between">
                    <span className="text-sm font-bold text-gray-900">Balance Due at Install</span>
                    <span className="text-sm font-bold text-gray-900">{formatPrice(grandTotal - DEPOSIT_AMOUNT)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ═══ Notes ═══ */}
        {quote.notes && (
          <div className="px-8 pb-5">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-[11px] text-amber-600 uppercase tracking-wider font-semibold mb-1">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{quote.notes}</p>
            </div>
          </div>
        )}

        {/* ═══ Accept & deposit section (not printed) ═══ */}
        {!isDepositPaid && !verifying && (
          <div className="print:hidden px-8 pb-8">
            <div className="border-2 border-blue-100 rounded-xl p-6 bg-gradient-to-b from-blue-50/50 to-white space-y-5">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-gray-900">Ready to move forward?</h3>
                <p className="text-sm text-gray-600">
                  Accept this quote and schedule your install with a{" "}
                  <span className="font-semibold">${DEPOSIT_AMOUNT} transferable deposit</span>.
                </p>
              </div>

              <InstallDatePicker
                selectedDate={selectedDate}
                onSelect={(date) => { setSelectedDate(date); setError(null); }}
                busyDatesRaw={busyDatesRaw}
              />

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <Button
                onClick={handlePayDeposit}
                disabled={isProcessing || !selectedDate}
                className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                size="lg"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Redirecting to payment…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CreditCard className="size-5" />
                    Accept Quote & Pay ${DEPOSIT_AMOUNT} Deposit
                  </span>
                )}
              </Button>

              <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  Balance of {formatPrice(grandTotal - DEPOSIT_AMOUNT)} due at install
                </span>
              </div>
              <p className="text-[11px] text-center text-gray-400">
                Secure payment processed by Stripe. Deposit is transferable. Install date is subject to shop confirmation.
              </p>
            </div>
          </div>
        )}

        {/* ═══ Footer ═══ */}
        <div className="bg-gray-50 border-t px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-400">
            <div>
              <p className="text-gray-500 font-medium">Terms & Conditions</p>
              <p className="mt-1">Prices are estimates. Final pricing may vary by vehicle and configuration.</p>
              <p>Deposit is transferable. Balance is due upon completion of install.</p>
            </div>
            <div className="text-right shrink-0 space-y-0.5">
              <p className="font-medium text-gray-500">Star Truck Equipment</p>
              <p>2507 County Rd 231, Wharton, TX 77488</p>
              <p>(979) 532-1486 · startruckequipment.com</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom spacer */}
      <div className="h-8 print:hidden" />
    </div>
  );
}
