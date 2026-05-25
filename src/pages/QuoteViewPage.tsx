import { useQuery } from "convex/react";
import { ExternalLink, Phone, Mail, Wrench, Package, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api } from "../../convex/_generated/api";

function formatPrice(price: number) {
  return `$${price.toLocaleString()}`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function QuoteViewPage({ slug }: { slug: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quote = useQuery(api.quotes.getBySlug, { slug }) as any;

  if (quote === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="size-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading quote…</p>
        </div>
      </div>
    );
  }

  if (quote === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Package className="size-12 mx-auto mb-3 text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-800">
            Quote Not Found
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            This quote link may have expired or is invalid.
          </p>
        </div>
      </div>
    );
  }

  type QuoteLineItem = { unitPrice: number; quantity: number; installHours: number; brand: string; series: string; partNumber: string; category: string };
  const items: QuoteLineItem[] = quote.items ?? [];
  const laborRate: number = quote.laborRate ?? 0;
  const bedPrice: number = quote.inventoryPrice ?? 0;
  const truckMake: string | null = quote.truckMake ?? null;
  const truckConfig: string | null = quote.truckConfig ?? null;
  const inventoryUrl: string | null = quote.inventoryUrl ?? null;
  const inventoryTitle: string | null = quote.inventoryTitle ?? null;

  const partsTotal = items.reduce(
    (sum: number, item: QuoteLineItem) => sum + item.unitPrice * item.quantity,
    0
  );
  const installTotal = items.reduce(
    (sum: number, item: QuoteLineItem) => sum + item.installHours * laborRate * item.quantity,
    0
  );
  const grandTotal = partsTotal + installTotal + bedPrice;
  const totalInstallHours = items.reduce(
    (sum: number, item: QuoteLineItem) => sum + item.installHours * item.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-lg">★</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                Star Truck Equipment
              </h1>
              <p className="text-xs text-gray-500">
                Wharton, TX • (979) 532-1486
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Quote header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-gray-900">Quote</h2>
            <Badge
              variant="outline"
              className="text-xs font-mono uppercase tracking-wider"
            >
              {quote.slug}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            Created {formatDate(quote._creationTime)}
            {quote.createdBy && ` by ${quote.createdBy}`}
          </p>
        </div>

        {/* Customer / Vehicle info */}
        {(quote.customerName || quote.vehicleInfo) && (
          <Card>
            <CardContent className="p-4 space-y-2">
              {quote.customerName && (
                <p className="font-semibold text-gray-900">
                  {quote.customerName}
                </p>
              )}
              {quote.vehicleInfo && (
                <p className="text-sm text-gray-600">
                  Vehicle: {quote.vehicleInfo}
                </p>
              )}
              {quote.customerPhone && (
                <a
                  href={`tel:${quote.customerPhone}`}
                  className="flex items-center gap-1.5 text-sm text-blue-600"
                >
                  <Phone className="size-3.5" />
                  {quote.customerPhone}
                </a>
              )}
              {quote.customerEmail && (
                <a
                  href={`mailto:${quote.customerEmail}`}
                  className="flex items-center gap-1.5 text-sm text-blue-600"
                >
                  <Mail className="size-3.5" />
                  {quote.customerEmail}
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {/* Truck & Bed info */}
        {(truckMake || inventoryUrl) && (
          <Card>
            <CardContent className="p-4 space-y-3">
              {truckMake && (
                <div className="flex items-center gap-2">
                  <Truck className="size-4 text-gray-500 shrink-0" />
                  <span className="text-sm font-medium text-gray-900">
                    {truckMake}{truckConfig ? ` — ${truckConfig}` : ""}
                  </span>
                </div>
              )}
              {inventoryUrl && (
                <div>
                  <a
                    href={inventoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:underline font-medium text-sm"
                  >
                    <ExternalLink className="size-4 shrink-0" />
                    {inventoryTitle || "View Bed / Body on StarTruckEquipment.com"}
                  </a>
                  {bedPrice > 0 && (
                    <p className="text-sm font-semibold text-gray-900 mt-1 ml-6">
                      {formatPrice(bedPrice)}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Line items */}
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 bg-gray-50 rounded-t-lg border-b">
              <h3 className="font-semibold text-sm text-gray-700">
                Accessories & Parts
              </h3>
            </div>
            <div className="divide-y">
              {items.map((item, idx) => {
                const lineTotal = item.unitPrice * item.quantity;
                const installCost =
                  item.installHours * laborRate * item.quantity;
                return (
                  <div key={idx} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {item.brand} {item.series}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.partNumber} • {item.category}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatPrice(lineTotal)}
                        </p>
                        {item.quantity > 1 && (
                          <p className="text-[11px] text-gray-500">
                            {item.quantity} × {formatPrice(item.unitPrice)}
                          </p>
                        )}
                      </div>
                    </div>
                    {item.installHours > 0 && (
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Wrench className="size-3" />
                          {item.installHours}hr install × {item.quantity}
                        </span>
                        <span className="text-xs text-gray-600">
                          +{formatPrice(installCost)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardContent className="p-4 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Parts & Accessories</span>
              <span className="font-medium">{formatPrice(partsTotal)}</span>
            </div>
            {bedPrice > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Bed / Body</span>
                <span className="font-medium">{formatPrice(bedPrice)}</span>
              </div>
            )}
            {installTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Installation ({totalInstallHours}hrs @{" "}
                  {formatPrice(laborRate)}/hr)
                </span>
                <span className="font-medium">{formatPrice(installTotal)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span className="text-gray-900">Total</span>
              <span className="text-blue-700">{formatPrice(grandTotal)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {quote.notes && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm text-gray-700 mb-1">
                Notes
              </h3>
              <p className="text-sm text-gray-600 whitespace-pre-line">
                {quote.notes}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 space-y-1 pb-8">
          <p>Prices are estimates. Final pricing may vary by vehicle and configuration.</p>
          <p>
            Star Truck Equipment — 1711 N Fulton St, Wharton, TX 77488
          </p>
          <p>
            <a
              href="https://startruckequipment.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              startruckequipment.com
            </a>
            {" "} • (979) 532-1486
          </p>
        </div>
      </main>
    </div>
  );
}
