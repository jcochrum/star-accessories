import { useMutation, useQuery } from "convex/react";
import {
  DollarSign,
  Package,
  Search,

  Wrench,
  X,
  Tag,
  FileText,
  Minus,
  Plus,
  Trash2,
  Truck,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  SkipForward,
  Download,
  Mail,
  MessageSquare,
  Check,

} from "lucide-react";
import { FordLogo, RamLogo, ChevyLogo } from "@/components/TruckLogos";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
// ScrollArea available if needed
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { api } from "../../convex/_generated/api";
import {
  generateQuotePdf,
  type QuotePdfItem,
  type Salesperson,
  SALESPEOPLE,
} from "@/lib/generateQuotePdf";

// ─── Types ───────────────────────────────────────────────────────────────────

type Accessory = {
  _id: string;
  category: string;
  brand: string;
  series: string;
  partNumber: string;
  cost: number;
  mapPrice?: number;
  retailPrice?: number;
  sellPrice?: number;
  markupPercent?: number;
  installHours?: number;
  installCost?: number; // Pre-computed install cost (customer query)
  maxQty?: number;
  imageUrl?: string;
  fitmentMakes?: string[];  // If set, only show for matching truck make
  fitment?: Array<{ make: string; models: string[]; cabTypes: string[] }>;
  fitmentCabTypes?: string[];  // Universal cab types (independent of make)
  source: string;
  notes?: string;
  sortOrder: number;
  images?: Array<{ url: string; isPrimary?: boolean; caption?: string }>;
  compatibleCALengths?: string[];
};

type QuoteItem = {
  accessory: Accessory;
  quantity: number;
  customSellPrice?: number;
  customMarkup?: number;
  mountSide?: "driver" | "passenger" | "both";
};

type InventoryItem = {
  _id: string;
  title: string;
  url: string;
  price?: number;
  salePrice?: number;
  msrp?: number;
  stockNumber?: string;
  type?: string;
  bedCategory?: string;
  brand?: string;
  model?: string;
  imageUrl?: string;
  imageUrls?: string[];
  fitmentTags?: string[];
  hasHaySpike?: boolean;
  hasTrough?: boolean;
  description?: string;
  status: string;
};

// ─── Fitment configuration (mirrors STE website tags) ────────────────────────

type TruckConfig = {
  label: string;
  tag: string;
  section?: string;          // Visual section header (displayed once before group)
  brandFilter?: string;      // Only show beds of this brand
  surcharges?: { label: string; amount: number }[];  // Auto-added line items
  caLength?: string;         // Cab-to-axle length (for filtering underbody toolboxes)
};
type TruckMake = { label: string; icon: string; logo: string; logoImage?: string; LogoComponent?: React.ComponentType<{ className?: string }>; configs: TruckConfig[] };

const MEDIUM_DUTY_SURCHARGE = [{ label: "Medium Duty Headache Rack", amount: 1200 }];

const TRUCK_MAKES: TruckMake[] = [
  {
    label: "Ford",
    icon: "🔵",
    logo: "",
    logoImage: "/images/ford-logo.png",
    LogoComponent: FordLogo,
    configs: [
      // ── F250 / F350 ──
      { label: "Dually 2020+", tag: "FD20C", section: "F250 / F350", caLength: "56" },
      { label: "Dually 2017–2019", tag: "FD1719", caLength: "56" },
      { label: "Dually 2016 & Older", tag: "FD016", caLength: "56" },
      { label: "SRW Long Bed 2020+", tag: "FSLB20C", caLength: "56" },
      { label: "SRW Long Bed 2017–2019", tag: "FSLB1719", caLength: "56" },
      { label: "SRW Long Bed 2016 & Older", tag: "FSLBO016", caLength: "56" },
      { label: "SRW Short Bed", tag: "FSSB", caLength: "40" },
      // ── F450 ──
      { label: "F450 Pickup 2020+", tag: "FD20C", section: "F450", caLength: "56" },
      { label: "F450 Pickup 2017–2019", tag: "FD1719", caLength: "56" },
      { label: 'F450 Cab & Chassis 60"', tag: "CCB60", caLength: "60" },
      { label: 'F450 Cab & Chassis 84"', tag: "CCB84", caLength: "84" },
      // ── F650 / F750 Medium Duty ──
      { label: 'F650/F750 — 60" CA', tag: "CCB60", section: "F650 / F750 (Medium Duty)", brandFilter: "Bedrock", surcharges: MEDIUM_DUTY_SURCHARGE, caLength: "60" },
      { label: 'F650/F750 — 84" CA', tag: "CCB84", brandFilter: "Bedrock", surcharges: MEDIUM_DUTY_SURCHARGE, caLength: "84" },
    ],
  },
  {
    label: "Ram",
    icon: "🔴",
    logo: "",
    logoImage: "/images/ram-logo.png",
    LogoComponent: RamLogo,
    configs: [
      // ── 2500 / 3500 ──
      { label: "Dually 2003+", tag: "RD03C", section: "2500 / 3500", caLength: "56" },
      { label: "Dually 2002 & Older", tag: "RDO02", caLength: "56" },
      { label: "SRW Long Bed 2003+", tag: "RSLB03C", caLength: "56" },
      { label: "SRW Long Bed 2002 & Older", tag: "RSLBO02", caLength: "56" },
      { label: "Mega Cab Dually", tag: "Rmega", caLength: "38" },
      { label: "SRW Short Bed", tag: "RSSB", caLength: "38" },
      // ── 4500 / 5500 Cab & Chassis ──
      { label: '4500/5500 Cab & Chassis 60"', tag: "CCB60", section: "4500 / 5500", caLength: "60" },
      { label: '4500/5500 Cab & Chassis 84"', tag: "CCB84", caLength: "84" },
    ],
  },
  {
    label: "Chevy / GMC",
    icon: "🟡",
    logo: "",
    logoImage: "/images/gm-logo.png",
    LogoComponent: ChevyLogo,
    configs: [
      // ── 2500 / 3500 ──
      { label: "Dually", tag: "CD", section: "2500 / 3500", caLength: "56" },
      { label: "SRW Long Bed", tag: "CSLB", caLength: "56" },
      { label: "SRW Short Bed", tag: "CSSB", caLength: "42" },
      // ── 3500 Cab & Chassis ──
      { label: '3500 Cab & Chassis 60"', tag: "CCB60", section: "3500 Cab & Chassis", caLength: "60" },
      { label: '3500 Cab & Chassis 84"', tag: "CCB84", caLength: "84" },
      // ── 4500 / 5500 / 6500 Medium Duty ──
      { label: '4500/5500/6500 — 60" CA', tag: "CCB60", section: "4500/5500/6500 (Medium Duty)", brandFilter: "Bedrock", surcharges: MEDIUM_DUTY_SURCHARGE, caLength: "60" },
      { label: '4500/5500/6500 — 84" CA', tag: "CCB84", brandFilter: "Bedrock", surcharges: MEDIUM_DUTY_SURCHARGE, caLength: "84" },
    ],
  },
  {
    label: "Cab & Chassis",
    icon: "⚫",
    logo: "",
    configs: [
      // ── Ford ──
      { label: 'F350 — 60" CA', tag: "CCB60", section: "Ford", caLength: "60" },
      { label: 'F350 — 84" CA', tag: "CCB84", caLength: "84" },
      { label: 'F450 — 60" CA', tag: "CCB60", caLength: "60" },
      { label: 'F450 — 84" CA', tag: "CCB84", caLength: "84" },
      { label: 'F550 — 60" CA', tag: "CCB60", caLength: "60" },
      { label: 'F550 — 84" CA', tag: "CCB84", caLength: "84" },
      { label: 'F650 — 60" CA', tag: "CCB60", brandFilter: "Bedrock", surcharges: MEDIUM_DUTY_SURCHARGE, caLength: "60" },
      { label: 'F650 — 84" CA', tag: "CCB84", brandFilter: "Bedrock", surcharges: MEDIUM_DUTY_SURCHARGE, caLength: "84" },
      { label: 'F750 — 60" CA', tag: "CCB60", brandFilter: "Bedrock", surcharges: MEDIUM_DUTY_SURCHARGE, caLength: "60" },
      { label: 'F750 — 84" CA', tag: "CCB84", brandFilter: "Bedrock", surcharges: MEDIUM_DUTY_SURCHARGE, caLength: "84" },
      // ── Ram ──
      { label: 'Ram 3500 — 60" CA', tag: "CCB60", section: "Ram", caLength: "60" },
      { label: 'Ram 3500 — 84" CA', tag: "CCB84", caLength: "84" },
      { label: 'Ram 4500 — 60" CA', tag: "CCB60", caLength: "60" },
      { label: 'Ram 4500 — 84" CA', tag: "CCB84", caLength: "84" },
      { label: 'Ram 5500 — 60" CA', tag: "CCB60", caLength: "60" },
      { label: 'Ram 5500 — 84" CA', tag: "CCB84", caLength: "84" },
      // ── Chevy / GMC ──
      { label: '3500 — 60" CA', tag: "CCB60", section: "Chevy / GMC", caLength: "60" },
      { label: '3500 — 84" CA', tag: "CCB84", caLength: "84" },
      { label: '4500 — 60" CA', tag: "CCB60", brandFilter: "Bedrock", surcharges: MEDIUM_DUTY_SURCHARGE, caLength: "60" },
      { label: '4500 — 84" CA', tag: "CCB84", brandFilter: "Bedrock", surcharges: MEDIUM_DUTY_SURCHARGE, caLength: "84" },
      { label: '5500 — 60" CA', tag: "CCB60", brandFilter: "Bedrock", surcharges: MEDIUM_DUTY_SURCHARGE, caLength: "60" },
      { label: '5500 — 84" CA', tag: "CCB84", brandFilter: "Bedrock", surcharges: MEDIUM_DUTY_SURCHARGE, caLength: "84" },
      { label: '6500 — 60" CA', tag: "CCB60", brandFilter: "Bedrock", surcharges: MEDIUM_DUTY_SURCHARGE, caLength: "60" },
      { label: '6500 — 84" CA', tag: "CCB84", brandFilter: "Bedrock", surcharges: MEDIUM_DUTY_SURCHARGE, caLength: "84" },
    ],
  },
];

// ─── Category icons ──────────────────────────────────────────────────────────

// Category icons removed per Jon's request

// Categories where quantity is limited to 1 (one per truck)
const SINGLE_QTY_CATEGORIES = new Set([
  "Front Bumpers",
  "Rear Bumpers",
  "Grille Guards",
  "Gooseneck Hitches",
  "Bed Liners",
]);

// ─── Category display rename ─────────────────────────────────────────────────
const CATEGORY_DISPLAY_NAME: Record<string, string> = {
  "Transfer Tanks": "Fuel Tanks",
};
function displayCategoryName(dbName: string): string {
  return CATEGORY_DISPLAY_NAME[dbName] || dbName;
}

// ─── Utility functions ───────────────────────────────────────────────────────

function getMaxQty(item: Accessory): number | undefined {
  if (item.maxQty) return item.maxQty;
  if (SINGLE_QTY_CATEGORIES.has(item.category)) return 1;
  return undefined; // unlimited
}

function getEffectiveSellPrice(item: Accessory, defaultMarkup: number): number {
  if (item.sellPrice !== undefined && item.sellPrice > 0) return item.sellPrice;
  if (item.cost > 0) {
    const markup = item.markupPercent ?? defaultMarkup;
    return Math.round(item.cost * (1 + markup / 100));
  }
  return 0;
}

function getEffectiveMarkup(item: Accessory, defaultMarkup: number): number {
  if (item.sellPrice !== undefined && item.sellPrice > 0 && item.cost > 0) {
    return Math.round(((item.sellPrice - item.cost) / item.cost) * 100);
  }
  return item.markupPercent ?? defaultMarkup;
}

function formatPrice(price: number) {
  if (price === 0) return "TBD";
  const rounded = Math.round(price);
  return `$${rounded.toLocaleString()}`;
}

// ─── Step 1: Truck Selector ──────────────────────────────────────────────────

function TruckSelector({
  onSelect,
  onSkip,
  staffMode = true,
}: {
  onSelect: (make: TruckMake, config: TruckConfig) => void;
  onSkip: () => void;
  staffMode?: boolean;
}) {
  const [selectedMake, setSelectedMake] = useState<TruckMake | null>(null);

  if (!selectedMake) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <img src="/images/truck-icon.png" alt="Truck" className="size-14 mx-auto mb-3" />
          <h2 className="text-2xl font-bold">What truck is it going on?</h2>
          <p className="text-muted-foreground mt-1">
            Select the truck to see matching beds & accessories
          </p>
        </div>

        <div className="space-y-3">
          {TRUCK_MAKES.map((make) => (
            <button
              key={make.label}
              type="button"
              onClick={() => setSelectedMake(make)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all active:scale-[0.98]"
            >
              {make.logoImage ? (
                <img src={make.logoImage} alt={make.label} className="h-10 w-16 object-contain shrink-0" />
              ) : make.LogoComponent ? (
                <make.LogoComponent className="h-10 w-16 shrink-0" />
              ) : (
                <div className="size-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                  <Truck className="size-5 text-white" />
                </div>
              )}
              <span className="text-lg font-semibold flex-1 text-left">
                {make.label}
              </span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </button>
          ))}
        </div>

        {staffMode && (
        <button
          type="button"
          onClick={onSkip}
          className="w-full mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2 py-3"
        >
          <SkipForward className="size-4" />
          Skip — accessories only (no bed)
        </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <button
        type="button"
        onClick={() => setSelectedMake(null)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="size-4" />
        Back to makes
      </button>

      <div className="text-center mb-8">
        {selectedMake.logoImage ? (
          <img src={selectedMake.logoImage} alt={selectedMake.label} className="h-12 w-20 object-contain mx-auto" />
        ) : selectedMake.LogoComponent ? (
          <selectedMake.LogoComponent className="h-12 w-20 mx-auto" />
        ) : (
          <div className="size-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto">
            <Truck className="size-6 text-white" />
          </div>
        )}
        <h2 className="text-2xl font-bold mt-2">{selectedMake.label}</h2>
        <p className="text-muted-foreground mt-1">
          Select your truck configuration
        </p>
      </div>

      <div className="space-y-2">
        {selectedMake.configs.map((config, idx) => (
          <div key={`${config.tag}-${idx}`}>
            {config.section && (
              <div className={`flex items-center gap-2 ${idx > 0 ? "mt-4 pt-3 border-t border-border/50" : ""} mb-2`}>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {config.section}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => onSelect(selectedMake, config)}
              className="w-full flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all active:scale-[0.98]"
            >
              <span className="text-sm font-semibold flex-1 text-left">
                {config.label}
              </span>
              {config.surcharges && staffMode && (
                <span className="text-[10px] text-amber-500 font-medium">+${config.surcharges.reduce((s, c) => s + c.amount, 0)}</span>
              )}
              <ArrowRight className="size-4 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>

      {staffMode && (
      <button
        type="button"
        onClick={onSkip}
        className="w-full mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2 py-3"
      >
        <SkipForward className="size-4" />
        Skip — accessories only (no bed)
      </button>
      )}
    </div>
  );
}

// ─── Bed Detail Modal with Photo Gallery ─────────────────────────────────────

function BedDetailModal({
  bed,
  onClose,
  onSelect,
  staffMode = true,
}: {
  bed: InventoryItem;
  onClose: () => void;
  onSelect: (bed: InventoryItem) => void;
  staffMode?: boolean;
}) {
  // Combine all available images into a gallery
  const allImages = useMemo(() => {
    const imgs: string[] = [];
    if (bed.imageUrls && bed.imageUrls.length > 0) {
      imgs.push(...bed.imageUrls);
    } else if (bed.imageUrl) {
      imgs.push(bed.imageUrl);
    }
    return imgs;
  }, [bed]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const hasMultiple = allImages.length > 1;

  const goNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIdx((i) => (i + 1) % allImages.length);
  }, [allImages.length]);

  const goPrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIdx((i) => (i - 1 + allImages.length) % allImages.length);
  }, [allImages.length]);

  // Swipe support
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff < 0) setCurrentIdx((i) => (i + 1) % allImages.length);
      else setCurrentIdx((i) => (i - 1 + allImages.length) % allImages.length);
    }
    touchStartX.current = null;
  }, [allImages.length]);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image Gallery */}
        {allImages.length > 0 ? (
          <div
            className="relative"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={allImages[currentIdx]}
              alt={`${bed.title} — photo ${currentIdx + 1}`}
              className="w-full h-56 sm:h-72 object-cover rounded-t-2xl"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 z-10"
            >
              <X className="size-5" />
            </button>
            {/* Prev / Next arrows */}
            {hasMultiple && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}
            {/* Dots / counter */}
            {hasMultiple && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {allImages.length <= 8 ? (
                  allImages.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setCurrentIdx(i); }}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i === currentIdx ? "bg-white scale-125" : "bg-white/50"
                      }`}
                    />
                  ))
                ) : (
                  <span className="text-white text-xs font-medium bg-black/50 px-2.5 py-1 rounded-full">
                    {currentIdx + 1} / {allImages.length}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="relative h-40 bg-muted flex items-center justify-center rounded-t-2xl">
            <Truck className="size-12 text-muted-foreground/30" />
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70"
            >
              <X className="size-5" />
            </button>
          </div>
        )}

        {/* Thumbnail strip */}
        {hasMultiple && (
          <div className="flex gap-1.5 px-4 py-2 overflow-x-auto bg-muted/30">
            {allImages.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIdx(i)}
                className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                  i === currentIdx ? "border-primary ring-1 ring-primary/30" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Details */}
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-lg font-bold leading-tight">{bed.title}</h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {bed.brand && <Badge variant="outline">{bed.brand}</Badge>}
              {bed.model && <Badge variant="outline">{bed.model}</Badge>}
              {bed.bedCategory && <Badge variant="secondary">{bed.bedCategory}</Badge>}
              {bed.hasHaySpike && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300">Hay Spike</Badge>
              )}
              {bed.hasTrough && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-300">Trough</Badge>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-1">
            {(bed.salePrice || bed.price) && (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-green-700">
                  {formatPrice(bed.salePrice || bed.price!)}
                </span>
                {bed.salePrice && bed.price && bed.salePrice < bed.price && (
                  <span className="text-sm line-through text-muted-foreground">
                    {formatPrice(bed.price)}
                  </span>
                )}
              </div>
            )}
            {bed.msrp && bed.msrp !== bed.price && (
              <p className="text-xs text-muted-foreground">MSRP: {formatPrice(bed.msrp)}</p>
            )}
          </div>

          {/* Info rows */}
          <div className="space-y-2 text-sm">
            {bed.stockNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stock #</span>
                <span className="font-medium">{bed.stockNumber}</span>
              </div>
            )}
            {bed.type && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{bed.type}</span>
              </div>
            )}
            {bed.bedCategory && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span className="font-medium">{bed.bedCategory}</span>
              </div>
            )}
          </div>

          {/* View on website link — staff only */}
          {staffMode && bed.url && (
            <a
              href={bed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-4" />
              View full details on website
            </a>
          )}

          {/* Customer-facing inline specs — always visible */}
          {!staffMode && (() => {
            const specLines: string[] = [];
            if (bed.description) {
              specLines.push(...bed.description.split("\n").filter(l => l && l.trim().toLowerCase() !== "info"));
            } else {
              // Build basic specs from available fields when no scraped description
              if (bed.brand) specLines.push(`Brand: ${bed.brand}`);
              if (bed.model) specLines.push(`Model: ${bed.model}`);
              if (bed.type) specLines.push(`Type: ${bed.type}`);
              if (bed.bedCategory) specLines.push(`Category: ${bed.bedCategory}`);
              if (bed.fitmentTags && bed.fitmentTags.length > 0) {
                specLines.push(`Compatible fitments: ${bed.fitmentTags.join(", ")}`);
              }
              if (bed.hasHaySpike) specLines.push("Includes hay spike");
              if (bed.hasTrough) specLines.push("Includes feed trough");
            }
            if (specLines.length === 0) return null;
            return (
              <details className="group border rounded-lg">
                <summary className="flex items-center justify-center gap-2 px-4 py-3 cursor-pointer text-primary font-semibold text-base hover:bg-primary/5 transition-colors list-none">
                  <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
                  See Full Specs &amp; Details
                </summary>
                <div className="px-4 pb-4 pt-2 border-t">
                  <ul className="space-y-1.5 text-sm text-foreground">
                    {specLines.map((line, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            );
          })()}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => onSelect(bed)}
              className="flex-1 h-12 text-base font-semibold"
            >
              Select This Bed
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-12 text-base"
            >
              Keep Looking
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Bed Picker ──────────────────────────────────────────────────────

// ─── Bed Category icons & display order ──────────────────────────────────────

// Brand logos for bed manufacturers
const BRAND_LOGOS: Record<string, string> = {
  "Bedrock": "/logos/bedrock.png",
  "Bradford Built": "https://bradfordbuilt.com/wp-content/uploads/2021/06/bradford-built-logo.png",
  "Norstar": "/logos/norstar.webp",
  "NXG": "/logos/nxg.png",
  "CM Truck Beds": "/logos/cm.png",
  "CM": "/logos/cm.png",
  "Pronghorn": "/logos/pronghorn.webp",
  "Rugby": "https://rugbymfg.com/wp-content/uploads/2020/10/rugby-logo-300.png",
  "Knapheide": "https://www.knapheide.com/images/knapheide-logo.svg",
  "SpaceKap": "/logos/spacekap.png",
  "STI": "/logos/sti.png",
  "RKI": "/logos/rki.jpg",
};

const BED_CATEGORY_META: Record<string, { icon: string; image?: string; order: number }> = {
  "Non-Skirted":     { icon: "🛻", image: "/images/non-skirted.png", order: 1 },
  "Skirted":         { icon: "🚛", image: "/images/skirted.png", order: 2 },
  "Skirted Deluxe":  { icon: "✨", image: "/images/skirted-deluxe.png", order: 3 },
  "Platform":        { icon: "📐", image: "/images/platform.png", order: 4 },
  "Hauler":          { icon: "🏋️", image: "/images/hauler.png", order: 5 },
  "Utility":         { icon: "🔧", image: "/images/utility.png", order: 6 },
  "Service Body":    { icon: "🧰", image: "/images/service-body.png", order: 7 },
  "Crane Body":      { icon: "🏗️", image: "/images/crane-body.png", order: 8 },
  "Dump":            { icon: "⏬", image: "/logos/dump_body.jpg", order: 9 },
  "SpaceKap":        { icon: "🏠", order: 10 },
};

// ─── Step 2: Bed Picker (Category → Brand → Beds) ───────────────────────────

function BedPicker({
  make,
  config,
  onSelectBed,
  onSkip,
  onBack,
  onCustomOrder,
  staffMode = true,
  pushNav,
}: {
  make: TruckMake;
  config: TruckConfig;
  onSelectBed: (bed: InventoryItem) => void;
  onSkip: () => void;
  onBack: () => void;
  onCustomOrder?: (bedStyle?: string, brand?: string) => void;
  staffMode?: boolean;
  pushNav?: () => void;
}) {
  const allInventory = useQuery(api.inventory.list);

  type BedSubStep = "category" | "brand" | "beds";
  const [subStep, setSubStep] = useState<BedSubStep>("category");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [bedSearch, setBedSearch] = useState("");
  const [haySpike, setHaySpike] = useState(false);
  const [trough, setTrough] = useState(false);
  const [previewBed, setPreviewBed] = useState<InventoryItem | null>(null);
  const [showCustomOrderForm, setShowCustomOrderForm] = useState(false);
  const [customOrderFormStyle, setCustomOrderFormStyle] = useState<string | null>(null);
  const [customBrandPref, setCustomBrandPref] = useState("");
  const [customStylePref, setCustomStylePref] = useState("");

  // All unique BED brands from inventory for custom order dropdowns (only items typed as "Truck Bed")
  const allBrands = useMemo(() => {
    if (!allInventory) return [];
    const set = new Set<string>();
    for (const b of allInventory) {
      if (b.brand && b.type === "Truck Bed") set.add(b.brand);
    }
    return Array.from(set).sort();
  }, [allInventory]);

  const allBedStyles = useMemo(() => {
    const known = Object.keys(BED_CATEGORY_META).sort((a, b) =>
      (BED_CATEGORY_META[a]?.order ?? 99) - (BED_CATEGORY_META[b]?.order ?? 99)
    );
    // Also add any styles from inventory not in the static list
    if (allInventory) {
      for (const b of allInventory) {
        if (b.bedCategory && !known.includes(b.bedCategory)) known.push(b.bedCategory);
      }
    }
    return known;
  }, [allInventory]);

  // Browser back button support
  const subStepRef = useRef(subStep);
  subStepRef.current = subStep;
  const brandsLenRef = useRef(0);

  useEffect(() => {
    const handleBrowserBack = () => {
      const s = subStepRef.current;
      if (s === "beds") {
        setBedSearch("");
        if (brandsLenRef.current <= 1) {
          setSelectedBrand(null);
          setSelectedCategory(null);
          setSubStep("category");
        } else {
          setSelectedBrand(null);
          setSubStep("brand");
        }
      } else if (s === "brand") {
        setSelectedCategory(null);
        setSubStep("category");
      } else {
        onBack();
      }
    };
    window.addEventListener("app-nav-back", handleBrowserBack);
    return () => window.removeEventListener("app-nav-back", handleBrowserBack);
  }, [onBack]);

  // All beds that match this truck config (+ optional brand filter for medium duty)
  const matchingBeds = useMemo(() => {
    if (!allInventory) return [];
    let beds = allInventory.filter(
      (inv) =>
        inv.fitmentTags &&
        inv.fitmentTags.includes(config.tag)
    );
    if (config.brandFilter) {
      beds = beds.filter((inv) => inv.brand === config.brandFilter);
    }
    return beds;
  }, [allInventory, config.tag, config.brandFilter]);

  // Categories available for this truck (with counts)
  const categories = useMemo(() => {
    let source = matchingBeds;
    if (haySpike) source = source.filter((b) => b.hasHaySpike === true);
    if (trough) source = source.filter((b) => b.hasTrough === true);
    const counts: Record<string, number> = {};
    for (const b of source) {
      const cat = b.bedCategory || "Other";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        icon: BED_CATEGORY_META[name]?.icon ?? "📦",
        order: BED_CATEGORY_META[name]?.order ?? 99,
      }))
      .sort((a, b) => a.order - b.order);
  }, [matchingBeds, haySpike, trough]);

  // Brands available within the selected category (with counts)
  const brands = useMemo(() => {
    if (!selectedCategory) return [];
    let source = matchingBeds;
    if (haySpike) source = source.filter((b) => b.hasHaySpike === true);
    if (trough) source = source.filter((b) => b.hasTrough === true);
    const counts: Record<string, number> = {};
    for (const b of source) {
      if ((b.bedCategory || "Other") !== selectedCategory) continue;
      const brand = b.brand || "Other";
      counts[brand] = (counts[brand] || 0) + 1;
    }
    const result = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    brandsLenRef.current = result.length;
    return result;
  }, [matchingBeds, selectedCategory, haySpike, trough]);

  // Final filtered bed list
  const filteredBeds = useMemo(() => {
    let beds = matchingBeds;
    if (selectedCategory) {
      beds = beds.filter((b) => (b.bedCategory || "Other") === selectedCategory);
    }
    if (selectedBrand) {
      beds = beds.filter((b) => (b.brand || "Other") === selectedBrand);
    }
    if (haySpike) {
      beds = beds.filter((b) => b.hasHaySpike === true);
    }
    if (trough) {
      beds = beds.filter((b) => b.hasTrough === true);
    }
    if (bedSearch.trim()) {
      const q = bedSearch.toLowerCase();
      beds = beds.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.brand && b.brand.toLowerCase().includes(q)) ||
          (b.model && b.model.toLowerCase().includes(q)) ||
          (b.stockNumber && b.stockNumber.toLowerCase().includes(q))
      );
    }
    return beds;
  }, [matchingBeds, selectedCategory, selectedBrand, haySpike, trough, bedSearch]);

  // ── Back handler for sub-steps
  const handleSubBack = useCallback(() => {
    if (subStep === "beds") {
      setBedSearch("");
      // If only one brand existed, go back to category
      if (brands.length <= 1) {
        setSelectedBrand(null);
        setSelectedCategory(null);
        setSubStep("category");
      } else {
        setSelectedBrand(null);
        setSubStep("brand");
      }
    } else if (subStep === "brand") {
      setSelectedCategory(null);
      setSubStep("category");
    } else {
      onBack();
    }
  }, [subStep, brands.length, onBack]);

  // ── Select category
  const handleSelectCategory = useCallback(
    (cat: string) => {
      setSelectedCategory(cat);
      pushNav?.();
      // Count brands in this category (respecting hay spike filter)
      let catBeds = matchingBeds.filter((b) => (b.bedCategory || "Other") === cat);
      if (haySpike) catBeds = catBeds.filter((b) => b.hasHaySpike === true);
      if (trough) catBeds = catBeds.filter((b) => b.hasTrough === true);
      const uniqueBrands = new Set(catBeds.map((b) => b.brand || "Other"));
      if (uniqueBrands.size <= 1) {
        // Only one brand — skip brand step, go straight to beds
        setSelectedBrand(uniqueBrands.values().next().value ?? null);
        setSubStep("beds");
      } else {
        setSubStep("brand");
      }
    },
    [matchingBeds, haySpike, trough, pushNav]
  );

  // ── Select brand
  const handleSelectBrand = useCallback((brand: string) => {
    setSelectedBrand(brand);
    pushNav?.();
    setSubStep("beds");
  }, [pushNav]);

  // ── Breadcrumb text
  const breadcrumb = useMemo(() => {
    const parts = [`${make.label} ${config.label}`];
    if (selectedCategory) parts.push(selectedCategory);
    if (selectedBrand) parts.push(selectedBrand);
    return parts;
  }, [make.label, config.label, selectedCategory, selectedBrand]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Back button */}
      <button
        type="button"
        onClick={handleSubBack}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-foreground bg-white border rounded-lg hover:bg-gray-50 active:scale-[0.98] transition-all mb-4 shadow-sm"
      >
        <ChevronLeft className="size-4" />
        {subStep === "category" ? "Back" : subStep === "brand" ? "Back to bed types" : "Back to brands"}
      </button>

      {/* Truck header + breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        {make.logoImage ? (
          <img src={make.logoImage} alt={make.label} className="h-8 w-14 object-contain shrink-0" />
        ) : make.LogoComponent ? (
          <make.LogoComponent className="h-8 w-14 shrink-0" />
        ) : (
          <div className="size-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
            <Truck className="size-4 text-white" />
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold leading-tight">
            {breadcrumb.join(" › ")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {!allInventory
              ? "Loading…"
              : subStep === "category"
                ? `${matchingBeds.length} beds in stock that fit`
                : subStep === "brand"
                  ? `${matchingBeds.filter((b) => (b.bedCategory || "Other") === selectedCategory).length} in this category`
                  : `${filteredBeds.length} beds`}
          </p>
        </div>
      </div>

      {/* Medium Duty notice */}
      {config.surcharges && config.surcharges.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 text-sm">
          <span className="font-semibold text-amber-600">Medium Duty</span>
          {staffMode ? (
            <>
              <span className="text-muted-foreground"> — {config.brandFilter} beds only. </span>
              {config.surcharges.map((sc) => (
                <span key={sc.label} className="text-amber-600 font-medium">+${sc.amount} {sc.label}</span>
              ))}
              <span className="text-muted-foreground"> will be added to the quote.</span>
            </>
          ) : (
            <span className="text-muted-foreground"> — An additional $1,200 extra-tall headache rack is required for this truck and will be included in your quote.</span>
          )}
        </div>
      )}

      {/* Loading state */}
      {!allInventory ? (
        <div className="text-center py-12 text-muted-foreground">Loading inventory…</div>
      ) : (
        <>
          {/* ── Sub-step: Category selector ── */}
          {subStep === "category" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground mb-1">Select a bed type</p>
              {categories.map((cat) => {
                const meta = BED_CATEGORY_META[cat.name];
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => handleSelectCategory(cat.name)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all active:scale-[0.99]"
                  >
                    {meta?.image ? (
                      <img
                        src={meta.image}
                        alt={cat.name}
                        className="w-16 h-12 rounded-lg object-contain bg-white shrink-0"
                      />
                    ) : (
                      <span className="text-2xl w-16 text-center shrink-0">{cat.icon}</span>
                    )}
                    <span className="flex-1 text-left font-semibold">{cat.name}</span>
                    <span className="text-xs text-muted-foreground font-medium">{cat.count} in stock</span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                );
              })}

              {/* Hay spike toggle */}
              <div className="flex items-center gap-3 p-4 rounded-xl border bg-card">
                <img src="/logos/hayspike_icon.jpg" alt="Hay Spike" className="w-10 h-8 rounded object-cover shrink-0" />
                <span className="flex-1 text-left font-medium">Hay Spike</span>
                <button
                  type="button"
                  onClick={() => setHaySpike(!haySpike)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    haySpike ? "bg-primary" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      haySpike ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Trough toggle */}
              <div className="flex items-center gap-3 p-4 rounded-xl border bg-card">
                <img src="/logos/trough_icon.png" alt="Trough" className="w-10 h-8 rounded object-cover shrink-0" />
                <span className="flex-1 text-left font-medium">Trough</span>
                <button
                  type="button"
                  onClick={() => setTrough(!trough)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    trough ? "bg-primary" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      trough ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* No trough beds in stock */}
              {trough && !haySpike && categories.length === 0 && (
                <div className="mt-4 space-y-4">
                  <div className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50 space-y-3">
                    <p className="text-base font-semibold text-amber-900 text-center">
                      No trough beds in stock for this truck.
                    </p>
                    <button
                      type="button"
                      onClick={() => setTrough(false)}
                      className="w-full px-4 py-3 rounded-lg bg-green-600 border-2 border-green-700 text-white font-bold text-base hover:bg-green-700 transition-colors shadow-md"
                    >
                      ✅ See what we have in stock instead
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (staffMode) { onCustomOrder?.("Skirted"); } else { setCustomOrderFormStyle("Skirted"); setShowCustomOrderForm(true); } }}
                      className="w-full px-4 py-3 rounded-lg bg-orange-500 border-2 border-orange-600 text-white font-bold text-base hover:bg-orange-600 transition-colors shadow-md"
                    >
                      Continue with custom quote
                    </button>
                  </div>
                </div>
              )}

              {/* No hay spike beds in stock — show all bed styles for custom order */}
              {haySpike && categories.length === 0 && (
                <div className="mt-4 space-y-4">
                  <div className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50 space-y-3">
                    <p className="text-base font-semibold text-amber-900 text-center">
                      No hay spike beds in stock for this truck.
                    </p>
                    <button
                      type="button"
                      onClick={() => setHaySpike(false)}
                      className="w-full px-4 py-3 rounded-lg bg-green-600 border-2 border-green-700 text-white font-bold text-base hover:bg-green-700 transition-colors shadow-md"
                    >
                      ✅ See what we have in stock instead
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (staffMode) {
                          onCustomOrder?.();
                        } else {
                          setCustomOrderFormStyle(null);
                          setShowCustomOrderForm(true);
                        }
                      }}
                      className="w-full px-4 py-3 rounded-lg bg-orange-500 border-2 border-orange-600 text-white font-bold text-base hover:bg-orange-600 transition-colors shadow-md"
                    >
                      Continue with custom quote
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Sub-step: Brand selector ── */}
          {subStep === "brand" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground mb-1">In-Stock Options</p>
              {/* All brands button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedBrand(null);
                  setSubStep("beds");
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all active:scale-[0.99]"
              >
                <span className="flex-1 text-left font-semibold">All Brands</span>
                <span className="text-xs text-muted-foreground font-medium">
                  {brands.reduce((s, b) => s + b.count, 0)} in stock
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
              {brands.map((brand) => (
                <button
                  key={brand.name}
                  type="button"
                  onClick={() => handleSelectBrand(brand.name)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all active:scale-[0.99]"
                >
                  {BRAND_LOGOS[brand.name] ? (
                    <img
                      src={BRAND_LOGOS[brand.name]}
                      alt={brand.name}
                      className="w-12 h-8 object-contain shrink-0"
                    />
                  ) : (
                    <span className="w-12 h-8 flex items-center justify-center text-lg font-bold text-muted-foreground shrink-0">
                      {brand.name.charAt(0)}
                    </span>
                  )}
                  <span className="flex-1 text-left font-medium">{brand.name}</span>
                  <span className="text-xs text-muted-foreground font-medium">{brand.count} in stock</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}

              {/* Custom order option */}
              {!staffMode && (
                <div className="mt-4 p-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 space-y-2">
                  <p className="text-sm font-medium text-center">Don't see what you want?</p>
                  <button
                    type="button"
                    onClick={() => { if (staffMode) { onCustomOrder?.(selectedCategory ?? undefined); } else { setCustomOrderFormStyle(selectedCategory ?? null); setShowCustomOrderForm(true); } }}
                    className="w-full px-4 py-3 rounded-lg bg-[#1a1a1a] text-white font-semibold text-sm hover:bg-[#333] transition-colors"
                  >
                    Request a Custom Order Quote
                  </button>
                  <p className="text-xs text-muted-foreground text-center">
                    Most in-stock options can be installed within two weeks. Custom-ordered beds may take 4+ weeks.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Sub-step: Individual beds ── */}
          {subStep === "beds" && (
            <>
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search beds by model, stock #…"
                  value={bedSearch}
                  onChange={(e) => setBedSearch(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>

              {filteredBeds.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <div className="text-muted-foreground">
                    <Package className="size-10 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">
                      {bedSearch ? "No beds match your search" : "We don't currently have this model in stock for your truck."}
                    </p>
                  </div>
                  {!bedSearch && !staffMode && (
                    <div className="flex flex-col gap-2 max-w-sm mx-auto">
                      {(selectedCategory || selectedBrand) && (
                        <button
                          type="button"
                          onClick={() => { setSelectedBrand(null); setSelectedCategory(null); if (haySpike) setHaySpike(false); }}
                          className="w-full px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
                        >
                          See what we do have in stock
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { if (staffMode) { onCustomOrder?.(selectedCategory ?? undefined); } else { setCustomOrderFormStyle(selectedCategory ?? null); setShowCustomOrderForm(true); } }}
                        className="w-full px-4 py-2.5 rounded-lg border bg-card text-foreground font-semibold text-sm hover:bg-accent transition-colors"
                      >
                        Continue with a custom order quote
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredBeds.map((bed) => (
                    <button
                      key={bed._id}
                      type="button"
                      onClick={() => setPreviewBed(bed as InventoryItem)}
                      className="text-left p-3 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all active:scale-[0.98] flex gap-3"
                    >
                      {bed.imageUrl ? (
                        <img
                          src={bed.imageUrl}
                          alt={bed.title}
                          className="size-16 rounded-lg object-cover bg-muted shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="size-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Truck className="size-6 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight line-clamp-2">
                          {bed.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {(bed.salePrice || bed.price) && (
                            <span className="text-sm font-bold text-green-700">
                              {formatPrice(bed.salePrice || bed.price!)}
                            </span>
                          )}
                          {bed.salePrice && bed.price && bed.salePrice < bed.price && (
                            <span className="text-xs line-through text-muted-foreground">
                              {formatPrice(bed.price)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {bed.stockNumber && (
                            <span className="text-[10px] text-muted-foreground">
                              #{bed.stockNumber}
                            </span>
                          )}
                          {bed.brand && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1">
                              {bed.brand}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      <button
        type="button"
        onClick={onSkip}
        className="w-full mt-6 py-3 px-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 text-sm font-semibold text-muted-foreground hover:text-primary transition-all flex items-center justify-center gap-2"
      >
        <SkipForward className="size-4" />
        Skip bed — accessories only
      </button>

      {/* ── Bed Detail Preview Modal ── */}
      {previewBed && (
        <BedDetailModal
          bed={previewBed}
          onClose={() => setPreviewBed(null)}
          onSelect={(bed) => {
            onSelectBed(bed);
            setPreviewBed(null);
          }}
          staffMode={staffMode}
        />
      )}

      {/* ── Custom Order Preferences Form ── */}
      {showCustomOrderForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
             onClick={() => setShowCustomOrderForm(false)}>
          <div className="bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4"
               onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">📋 Custom Order Details</h3>
            <p className="text-sm text-muted-foreground">
              Help us find the right bed for you. Which brand and style do you prefer?
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Preferred Brand</label>
                <select
                  value={customBrandPref}
                  onChange={(e) => setCustomBrandPref(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value="">Select a brand…</option>
                  {allBrands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Preferred Bed Style</label>
                <select
                  value={customStylePref || customOrderFormStyle || ""}
                  onChange={(e) => setCustomStylePref(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value="">Select a style…</option>
                  {allBedStyles.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const style = customStylePref || customOrderFormStyle || undefined;
                const brand = customBrandPref || undefined;
                onCustomOrder?.(style, brand);
                setShowCustomOrderForm(false);
                setCustomBrandPref("");
                setCustomStylePref("");
              }}
              className="w-full px-4 py-3 rounded-lg bg-[#1a1a1a] text-white font-semibold text-sm hover:bg-[#333] transition-colors"
            >
              Continue to Accessories →
            </button>
            <button
              className="w-full p-2 rounded-lg text-sm text-muted-foreground hover:bg-accent/50"
              onClick={() => { setShowCustomOrderForm(false); setCustomBrandPref(""); setCustomStylePref(""); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Category Nav (wrapping grid — mobile friendly) ──────────────────────────

function CategoryNav({
  categories,
  selected,
  onSelect,
}: {
  categories: { name: string; count: number }[];
  selected: string | null;
  onSelect: (cat: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          selected === null
            ? "bg-primary text-primary-foreground shadow-md"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        All ({categories.reduce((s, c) => s + c.count, 0)})
      </button>
      {categories.map((cat) => (
        <button
          type="button"
          key={cat.name}
          onClick={() => onSelect(cat.name)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            selected === cat.name
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {displayCategoryName(cat.name)}
          <span className="ml-1 opacity-60">{cat.count}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Accessory Card ──────────────────────────────────────────────────────────

function AccessoryCard({
  item,
  laborRate,
  defaultMarkup,
  onAddToQuote,
  showCost,
  staffMode = true,
  truckMake,
}: {
  item: Accessory;
  laborRate: number;
  defaultMarkup: number;
  onAddToQuote: (item: Accessory) => void;
  showCost: boolean;
  staffMode?: boolean;
  truckMake?: string | null;
}) {
  const sellPrice = getEffectiveSellPrice(item, defaultMarkup);
  const installCost =
    item.installHours && item.installHours > 0
      ? item.installHours * laborRate
      : 0;
  const totalPrice = sellPrice + installCost;
  const margin =
    sellPrice > 0 && item.cost > 0
      ? ((sellPrice - item.cost) / sellPrice) * 100
      : 0;
  const effectiveMarkup = getEffectiveMarkup(item, defaultMarkup);
  const isPending = sellPrice === 0;
  const isAutoPrice =
    (item.sellPrice === undefined || item.sellPrice === 0) && item.cost > 0;

  const [imgError, setImgError] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Build gallery from images array, filtering by truck make when applicable
  const gallery = useMemo(() => {
    if (item.images && item.images.length > 0) {
      let imgs = [...item.images];
      // In customer mode with a truck selected, filter to matching make + universal images
      if (!staffMode && truckMake) {
        const makeFiltered = imgs.filter((img) => !(img as any).make || (img as any).make === truckMake);
        if (makeFiltered.length > 0) imgs = makeFiltered;
      }
      // Sort so primary is first
      const sorted = imgs.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
      return sorted.map((img) => img.url);
    }
    if (item.imageUrl) return [item.imageUrl];
    return [];
  }, [item.images, item.imageUrl, staffMode, truckMake]);

  const hasMultipleImages = gallery.length > 1;

  return (
    <Card
      className={`group transition-all hover:shadow-md ${isPending ? "opacity-60 border-dashed" : ""}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {gallery.length > 0 && !imgError ? (
            <div className="shrink-0 relative" style={{ width: 80, height: 80 }}>
              <div
                className="size-20 rounded-lg overflow-hidden bg-muted border cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
              >
                <img
                  src={gallery[galleryIdx] || gallery[0]}
                  alt={`${item.brand} ${item.series}`}
                  className="size-full object-contain p-1"
                  onError={() => setImgError(true)}
                  loading="lazy"
                />
              </div>
              {hasMultipleImages && (
                <>
                  <button
                    type="button"
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 bg-white/90 dark:bg-zinc-800/90 rounded-full shadow p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); setGalleryIdx((i) => (i - 1 + gallery.length) % gallery.length); }}
                  >
                    <ChevronLeft className="size-3" />
                  </button>
                  <button
                    type="button"
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 bg-white/90 dark:bg-zinc-800/90 rounded-full shadow p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); setGalleryIdx((i) => (i + 1) % gallery.length); }}
                  >
                    <ChevronRight className="size-3" />
                  </button>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {gallery.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`size-1.5 rounded-full transition-colors ${idx === galleryIdx ? "bg-primary" : "bg-muted-foreground/30"}`}
                        onClick={(e) => { e.stopPropagation(); setGalleryIdx(idx); }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="shrink-0 size-20 rounded-lg bg-muted border flex items-center justify-center">
              <Package className="size-8 text-muted-foreground/30" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {staffMode && (
                <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {item.partNumber}
                </span>
              )}
              <Badge variant="outline" className="text-xs shrink-0">
                {item.brand}
              </Badge>
            </div>
            <h3 className="font-semibold text-sm leading-tight mb-1">
              {item.series}
            </h3>
            {staffMode && item.notes && (
              <p className="text-xs text-muted-foreground">{item.notes}</p>
            )}
          </div>

          <div className="text-right shrink-0">
            {!isPending ? (
              <>
                <div className="text-xl font-bold tracking-tight text-primary">
                  {staffMode ? formatPrice(sellPrice) : formatPrice(totalPrice)}
                </div>
                {staffMode ? (
                  <div className="text-[11px] text-muted-foreground">
                    {isAutoPrice ? `${effectiveMarkup}% markup` : "parts only"}
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground">
                    installed
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm font-medium text-muted-foreground">
                Pricing TBD
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground">
          {staffMode ? (
            <>
              {item.installHours !== undefined && item.installHours > 0 && (
                <span className="flex items-center gap-1">
                  <Wrench className="size-3" />
                  {item.installHours}hr install
                  {laborRate > 0 && ` (+${formatPrice(installCost)})`}
                </span>
              )}
              {item.installHours === 0 && item.category !== "Bed Liners" && (
                <span className="flex items-center gap-1">
                  <Package className="size-3" />
                  No install needed
                </span>
              )}
            </>
          ) : (
            <>
              {item.installHours === 0 && item.category !== "Bed Liners" && (
                <span className="flex items-center gap-1">
                  <Package className="size-3" />
                  No install needed
                </span>
              )}
            </>
          )}
          {staffMode && !isPending && installCost > 0 && (
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <DollarSign className="size-3" />
              Total: {formatPrice(totalPrice)}
            </span>
          )}
          {showCost && staffMode && item.cost > 0 && (
            <span className="flex items-center gap-1 ml-auto text-amber-600 dark:text-amber-400">
              <Tag className="size-3" />
              Cost: {formatPrice(item.cost)} ({margin.toFixed(0)}% margin)
            </span>
          )}
        </div>

        {!isPending && (
          <Button
            size="sm"
            className="w-full mt-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => onAddToQuote(item)}
          >
            <Plus className="size-3.5 mr-1" />
            Add to Quote
          </Button>
        )}
      </CardContent>

      {/* Lightbox */}
      {lightboxOpen && gallery.length > 0 && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            type="button"
            className="absolute top-4 right-4 z-10 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition-colors"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="size-6" />
          </button>

          {/* Image counter */}
          {gallery.length > 1 && (
            <div className="absolute top-4 left-4 z-10 text-white/80 text-sm font-medium bg-black/40 px-3 py-1 rounded-full">
              {galleryIdx + 1} / {gallery.length}
            </div>
          )}

          {/* Previous button */}
          {gallery.length > 1 && (
            <button
              type="button"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition-colors"
              onClick={(e) => { e.stopPropagation(); setGalleryIdx((i) => (i - 1 + gallery.length) % gallery.length); }}
            >
              <ChevronLeft className="size-8" />
            </button>
          )}

          {/* Main image */}
          <img
            src={gallery[galleryIdx]}
            alt={`${item.brand} ${item.series}`}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next button */}
          {gallery.length > 1 && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition-colors"
              onClick={(e) => { e.stopPropagation(); setGalleryIdx((i) => (i + 1) % gallery.length); }}
            >
              <ChevronRight className="size-8" />
            </button>
          )}

          {/* Product info */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center text-white">
            <p className="font-semibold text-lg">{item.series}</p>
            <p className="text-white/70 text-sm">{item.brand}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Quote Panel (slide-out sheet) ───────────────────────────────────────────

function QuotePanel({
  items,
  laborRate,
  defaultMarkup,
  linkedBed,
  truckMake,
  truckConfig,
  bedInstallPrice,
  bedInstallEnabled,
  onToggleBedInstall,
  onUpdateBedInstallPrice,
  onUpdateQty,
  onUpdatePrice,
  onUpdateMarkup,
  onRemove,
  onClear,
  onShareEmail,
  onShareText,
  onClearBed,
  shareLoading,
  customerName,
  customerPhone,
  customerEmail,
  selectedSalesperson,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onCustomerEmailChange,
  onSalespersonChange,
  staffMode = true,
  onRequestQuote,
  isCustomOrder = false,
  customOrderBedStyle,
  customOrderBrand,
}: {
  items: QuoteItem[];
  laborRate: number;
  defaultMarkup: number;
  linkedBed: InventoryItem | null;
  truckMake: TruckMake | null;
  truckConfig: TruckConfig | null;
  bedInstallPrice: number;
  bedInstallEnabled: boolean;
  onToggleBedInstall: () => void;
  onUpdateBedInstallPrice: (price: number) => void;
  onUpdateQty: (id: string, qty: number) => void;
  onUpdatePrice: (id: string, price: number | undefined) => void;
  onUpdateMarkup: (id: string, markup: number | undefined) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onShareEmail: () => void;
  onShareText: () => void;
  onClearBed: () => void;
  shareLoading: boolean;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  selectedSalesperson: Salesperson | null;
  onCustomerNameChange: (v: string) => void;
  onCustomerPhoneChange: (v: string) => void;
  onCustomerEmailChange: (v: string) => void;
  onSalespersonChange: (v: Salesperson | null) => void;
  staffMode?: boolean;
  onRequestQuote?: () => void;
  isCustomOrder?: boolean;
  customOrderBedStyle?: string | null;
  customOrderBrand?: string | null;
}) {
  const quoteItemPrice = useCallback(
    (qi: QuoteItem) => {
      if (qi.customSellPrice !== undefined) return qi.customSellPrice;
      if (qi.customMarkup !== undefined) {
        return Math.round(qi.accessory.cost * (1 + qi.customMarkup / 100));
      }
      return getEffectiveSellPrice(qi.accessory, defaultMarkup);
    },
    [defaultMarkup]
  );

  const partsTotal = items.reduce(
    (sum, qi) => sum + quoteItemPrice(qi) * qi.quantity,
    0
  );
  const installTotal = items.reduce(
    (sum, qi) =>
      sum + (qi.accessory.installHours ?? 0) * qi.quantity * laborRate,
    0
  );
  const bedPrice = linkedBed?.salePrice || linkedBed?.price || 0;
  const bedInstallCost = linkedBed && bedInstallEnabled ? bedInstallPrice : 0;
  const totalInstallHours = items.reduce(
    (sum, qi) => sum + (qi.accessory.installHours ?? 0) * qi.quantity,
    0
  );

  // Tax state (local to QuotePanel)
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(6.75);

  const surchargeTotal = truckConfig?.surcharges?.reduce((s, c) => s + c.amount, 0) ?? 0;
  const subtotal = partsTotal + installTotal + bedPrice + bedInstallCost + surchargeTotal;
  const taxAmount = taxEnabled ? Math.round(subtotal * (taxRate / 100) * 100) / 100 : 0;
  const grandTotal = subtotal + taxAmount;

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Custom order badge */}
      {isCustomOrder && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-center">
          <span className="text-xs font-semibold text-amber-800">⚡ Custom Order Quote</span>
          {customOrderBedStyle && (
            <div className="text-xs text-amber-700 mt-0.5">Bed style: {customOrderBedStyle}</div>
          )}
          {customOrderBrand && (
            <div className="text-xs text-amber-700 mt-0.5">Preferred brand: {customOrderBrand}</div>
          )}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
          >
            <Trash2 className="size-3" />
            Clear
          </button>
        )}
      </div>

      {/* Truck info */}
      {truckMake && truckConfig && (
        <div className="bg-muted/50 rounded-lg p-3 mb-3 text-sm">
          <div className="flex items-center gap-2">
            {truckMake.logoImage ? (
              <img src={truckMake.logoImage} alt={truckMake.label} className="h-5 w-10 object-contain shrink-0" />
            ) : truckMake.LogoComponent ? (
              <truckMake.LogoComponent className="h-5 w-10 shrink-0" />
            ) : (
              <Truck className="size-5 text-muted-foreground" />
            )}
            <div>
              <span className="font-medium">{truckMake.label}</span>
              <span className="text-muted-foreground"> — {truckConfig.label}</span>
            </div>
          </div>
        </div>
      )}

      {/* Linked bed */}
      {linkedBed && (
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 mb-3 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <Truck className="size-3.5 text-blue-600 shrink-0" />
                <span className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">
                  Bed / Body
                </span>
              </div>
              <p className="text-sm font-medium leading-tight">
                {linkedBed.title}
              </p>
              {staffMode && bedPrice > 0 && (
                <p className="text-sm font-bold text-green-700 mt-0.5">
                  {formatPrice(bedPrice)}
                </p>
              )}
              {staffMode && (
              <a
                href={linkedBed.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline mt-1"
              >
                <ExternalLink className="size-3" />
                View on website
              </a>
              )}
            </div>
            <button
              type="button"
              onClick={onClearBed}
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              <X className="size-4" />
            </button>
          </div>
          {/* Bed Installation toggle — staff only */}
          {staffMode && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleBedInstall}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  bedInstallEnabled ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    bedInstallEnabled ? "translate-x-[18px]" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-xs font-medium">Installation</span>
            </div>
            {bedInstallEnabled && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">$</span>
                <input
                  type="number"
                  value={bedInstallPrice}
                  onChange={(e) =>
                    onUpdateBedInstallPrice(
                      Math.max(0, Number(e.target.value) || 0)
                    )
                  }
                  className="w-20 text-right text-xs font-bold text-green-700 bg-transparent border-b border-dashed border-blue-300 focus:outline-none focus:border-blue-600 py-0.5"
                />
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {/* Quote items */}
      {items.length === 0 && !linkedBed ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          <div className="text-center">
            <FileText className="size-10 mx-auto mb-2 opacity-30" />
            <p>No items in quote</p>
            <p className="text-xs mt-1">
              Tap &quot;Add to Quote&quot; on any item
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-auto">
          {items.map((qi) => {
            const price = quoteItemPrice(qi);
            const install =
              (qi.accessory.installHours ?? 0) * laborRate * qi.quantity;
            return (
              <QuoteItemRow
                key={qi.accessory._id}
                qi={qi}
                price={price}
                install={install}
                defaultMarkup={defaultMarkup}
                onUpdateQty={onUpdateQty}
                onUpdatePrice={onUpdatePrice}
                onUpdateMarkup={onUpdateMarkup}
                onRemove={onRemove}
                staffMode={staffMode}
              />
            );
          })}
        </div>
      )}

      {/* Totals & Share */}
      {(items.length > 0 || linkedBed) && (
        <div className="mt-auto pt-4 border-t space-y-2">
          {/* In customer mode, hide all pricing until contact info is complete */}
          {staffMode ? (
            <>
          {bedPrice > 0 && (
            <div className="flex justify-between text-sm">
              <span>Bed / Body</span>
              <span>{formatPrice(bedPrice)}</span>
            </div>
          )}
          {partsTotal > 0 && (
            <div className="flex justify-between text-sm">
              <span>Parts & Accessories</span>
              <span>{formatPrice(partsTotal)}</span>
            </div>
          )}
          {bedInstallCost > 0 && (
            <div className="flex justify-between text-sm">
              <span>Bed Installation</span>
              <span>{formatPrice(bedInstallCost)}</span>
            </div>
          )}
          {installTotal > 0 && (
            <div className="flex justify-between text-sm">
              <span>
                {`Accessory Install (${totalInstallHours}hrs @ ${formatPrice(laborRate)}/hr)`}
              </span>
              <span>{formatPrice(installTotal)}</span>
            </div>
          )}
          {truckConfig?.surcharges?.map((sc) => (
            <div key={sc.label} className="flex justify-between text-sm text-amber-600">
              <span>{sc.label}</span>
              <span>{formatPrice(sc.amount)}</span>
            </div>
          ))}
          {/* Tax toggle */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTaxEnabled(!taxEnabled)}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  taxEnabled ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    taxEnabled ? "translate-x-[18px]" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span>Tax</span>
              {taxEnabled && (
                <input
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number.parseFloat(e.target.value) || 0)}
                  step="0.25"
                  className="w-16 px-1.5 py-0.5 text-xs border rounded text-center"
                />
              )}
              {taxEnabled && <span className="text-xs text-muted-foreground">%</span>}
            </div>
            <span>{taxEnabled ? formatPrice(taxAmount) : "$0"}</span>
          </div>
          <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">{formatPrice(grandTotal)}</span>
            </div>
            </>
          ) : (
            /* Customer mode: no line totals, just a prompt */
            <div className="text-center py-3">
              <p className="text-sm text-muted-foreground">
                Enter your info below to see your full quote with pricing
              </p>
            </div>
          )}

          {/* Salesperson selector — staff only */}
          {staffMode && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground shrink-0">Salesperson:</span>
              <select
                value={selectedSalesperson?.name ?? ""}
                onChange={(e) => {
                  const sp = SALESPEOPLE.find((s) => s.name === e.target.value) ?? null;
                  onSalespersonChange(sp);
                }}
                className="flex-1 text-xs border rounded px-2 py-1.5 bg-white"
              >
                <option value="">Select...</option>
                {SALESPEOPLE.map((sp) => (
                  <option key={sp.name} value={sp.name}>{sp.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Customer info */}
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0 w-14">{staffMode ? "Customer:" : "Name:"}</span>
              <input
                type="text"
                placeholder="Name"
                value={customerName}
                onChange={(e) => onCustomerNameChange(e.target.value)}
                className="flex-1 text-xs border rounded px-2 py-1.5 bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0 w-14">Phone:</span>
              <input
                type="tel"
                placeholder="Phone number"
                value={customerPhone}
                onChange={(e) => onCustomerPhoneChange(e.target.value)}
                className="flex-1 text-xs border rounded px-2 py-1.5 bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0 w-14">Email:</span>
              <input
                type="email"
                placeholder="Email address"
                value={customerEmail}
                onChange={(e) => onCustomerEmailChange(e.target.value)}
                className="flex-1 text-xs border rounded px-2 py-1.5 bg-white"
              />
            </div>
          </div>

          {staffMode ? (
            <>
              <p className="text-[10px] text-center text-muted-foreground">
                Labor rate: ${laborRate}/hr • Default markup: {defaultMarkup}%
              </p>
              <div className="flex gap-2 mt-2">
                <Button
                  className="flex-1"
                  onClick={onShareEmail}
                  disabled={shareLoading}
                >
                  <Mail className="size-4 mr-2" />
                  {shareLoading ? "Creating…" : "Email"}
                </Button>
                <Button
                  className="flex-1"
                  onClick={onShareText}
                  disabled={shareLoading}
                >
                  <MessageSquare className="size-4 mr-2" />
                  {shareLoading ? "Creating…" : "Text"}
                </Button>
              </div>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  className="w-full border-2 border-primary/20 font-semibold"
                  onClick={() => {
                    const pdfItems: QuotePdfItem[] = [];
                    if (linkedBed) {
                      pdfItems.push({
                        activity: "Truck Bed Sales",
                        description: linkedBed.title || "Truck Bed",
                        qty: 1,
                        rate: bedPrice,
                        amount: bedPrice,
                      });
                    }
                    if (linkedBed && bedInstallEnabled && bedInstallCost > 0) {
                      pdfItems.push({
                        activity: "Installation",
                        description: "Installation",
                        qty: 1,
                        rate: bedInstallCost,
                        amount: bedInstallCost,
                      });
                    }
                    for (const qi of items) {
                      const p = quoteItemPrice(qi);
                      pdfItems.push({
                        activity: "Parts - Retail",
                        description: `${qi.accessory.brand} ${qi.accessory.series}${staffMode && qi.accessory.partNumber ? ` (${qi.accessory.partNumber})` : ""}`,
                        qty: qi.quantity,
                        rate: p,
                        amount: p * qi.quantity,
                      });
                    }
                    if (installTotal > 0) {
                      pdfItems.push({
                        activity: "Installation",
                        description: `Accessory Install (${totalInstallHours}hrs @ $${laborRate}/hr)`,
                        qty: 1,
                        rate: installTotal,
                        amount: installTotal,
                      });
                    }
                    for (const sc of truckConfig?.surcharges ?? []) {
                      pdfItems.push({
                        activity: "Installation",
                        description: sc.label,
                        qty: 1,
                        rate: sc.amount,
                        amount: sc.amount,
                      });
                    }
                    const estNum = String(100000 + Math.floor(Math.random() * 900000));
                    const today = new Date().toLocaleDateString("en-US", {
                      month: "2-digit",
                      day: "2-digit",
                      year: "numeric",
                    });
                    const pdf = generateQuotePdf({
                      estimateNumber: estNum,
                      date: today,
                      items: pdfItems,
                      subtotal,
                      taxRate: taxRate / 100,
                      taxEnabled,
                      total: grandTotal,
                      truckLabel:
                        truckMake && truckConfig
                          ? `${truckMake.label} — ${truckConfig.label}`
                          : undefined,
                      salesperson: selectedSalesperson ?? undefined,
                      customerName: customerName || undefined,
                      customerPhone: customerPhone || undefined,
                      customerEmail: customerEmail || undefined,
                    });
                    const blob = pdf.output("blob");
                    const blobUrl = URL.createObjectURL(blob);
                    window.open(blobUrl, "_blank");
                    toast.success("PDF quote opened!");
                  }}
                >
                  <Download className="size-4 mr-2" />
                  PDF Quote
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-2">
                {(() => {
                  const contactComplete = customerName.trim() && customerPhone.trim() && customerEmail.trim();
                  const missingFields = [
                    !customerName.trim() && "name",
                    !customerPhone.trim() && "phone",
                    !customerEmail.trim() && "email",
                  ].filter(Boolean);
                  return (
                    <>
                      <Button
                        className="w-full h-12 text-base font-semibold"
                        onClick={onRequestQuote}
                        disabled={shareLoading || !contactComplete}
                      >
                        <FileText className="size-5 mr-2" />
                        {shareLoading ? "Building Quote…" : "See Quote"}
                      </Button>
                      {!contactComplete && (
                        <p className="text-[10px] text-center text-amber-600 mt-2">
                          Please enter your {missingFields.join(", ")} above to continue
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Quote Item Row (with inline price editing) ──────────────────────────────

function QuoteItemRow({
  qi,
  price,
  install,
  defaultMarkup,
  onUpdateQty,
  onUpdatePrice,
  onUpdateMarkup,
  onRemove,
  staffMode = true,
}: {
  qi: QuoteItem;
  price: number;
  install: number;
  defaultMarkup: number;
  onUpdateQty: (id: string, qty: number) => void;
  onUpdatePrice: (id: string, price: number | undefined) => void;
  onUpdateMarkup: (id: string, markup: number | undefined) => void;
  onRemove: (id: string) => void;
  staffMode?: boolean;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [editMode, setEditMode] = useState<"price" | "markup">("price");
  const [editValue, setEditValue] = useState("");

  const openEdit = () => {
    setEditingPrice(true);
    setEditMode("price");
    setEditValue(String(price));
  };

  const saveEdit = () => {
    const val = parseFloat(editValue);
    if (isNaN(val) || val <= 0) {
      setEditingPrice(false);
      return;
    }
    if (editMode === "price") {
      onUpdatePrice(qi.accessory._id, val);
    } else {
      onUpdateMarkup(qi.accessory._id, val);
    }
    setEditingPrice(false);
  };

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">
            {qi.accessory.series}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {staffMode ? `${qi.accessory.partNumber} • ` : ""}{displayCategoryName(qi.accessory.category)}
            {qi.mountSide && (
              <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-medium">
                {qi.mountSide === "both" ? "Driver + Passenger" : qi.mountSide === "driver" ? "Driver's Side" : "Passenger's Side"}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(qi.accessory._id)}
          className="text-muted-foreground hover:text-destructive shrink-0"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-2">
        {/* Quantity controls */}
        {(() => {
          const max = getMaxQty(qi.accessory);
          const isFixed = max === 1;
          return (
            <div className="flex items-center gap-2">
              {isFixed ? (
                <span className="text-xs text-muted-foreground px-2 py-1">Qty: 1</span>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() =>
                      onUpdateQty(qi.accessory._id, Math.max(1, qi.quantity - 1))
                    }
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-6 text-center text-sm font-medium">
                    {qi.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() =>
                      onUpdateQty(
                        qi.accessory._id,
                        max ? Math.min(max, qi.quantity + 1) : qi.quantity + 1
                      )
                    }
                  >
                    <Plus className="size-3" />
                  </Button>
                </>
              )}
            </div>
          );
        })()}

        {/* Price (tap to edit in staff mode, read-only for customers) */}
        <div className="text-right">
          {staffMode && editingPrice ? (
            <div className="flex items-center gap-1">
              <div className="flex border rounded overflow-hidden text-xs">
                <button
                  type="button"
                  className={`px-2 py-1 ${editMode === "price" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  onClick={() => {
                    setEditMode("price");
                    setEditValue(String(price));
                  }}
                >
                  $ Price
                </button>
                <button
                  type="button"
                  className={`px-2 py-1 ${editMode === "markup" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  onClick={() => {
                    setEditMode("markup");
                    setEditValue(
                      String(
                        qi.customMarkup ??
                          qi.accessory.markupPercent ??
                          defaultMarkup
                      )
                    );
                  }}
                >
                  % Markup
                </button>
              </div>
              <Input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-20 h-7 text-xs text-right"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setEditingPrice(false);
                }}
                onBlur={saveEdit}
              />
            </div>
          ) : staffMode ? (
            <button
              type="button"
              onClick={openEdit}
              className="text-right hover:bg-muted rounded px-2 py-0.5 -mr-2 transition-colors"
            >
              <div className="text-base font-bold">{formatPrice(price)}</div>
              {install > 0 && (
                <div className="text-[10px] text-muted-foreground">
                  +{formatPrice(install)} install
                </div>
              )}
            </button>
          ) : (
            <div className="text-right">
              <div className="text-base font-bold text-muted-foreground/40">• • •</div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Step 3: Accessories Catalog ─────────────────────────────────────────────

function AccessoriesCatalog({
  truckMake,
  truckConfig,
  linkedBed,
  onAddToQuote,
  onChangeTruck,
  onChangeBed,
  showCost,
  staffMode = true,
  accessoriesOverride,
  pushNav,
}: {
  truckMake: TruckMake | null;
  truckConfig: TruckConfig | null;
  linkedBed: InventoryItem | null;
  onAddToQuote: (item: Accessory) => void;
  onChangeTruck: () => void;
  onChangeBed: () => void;
  showCost: boolean;
  staffMode?: boolean;
  accessoriesOverride?: Accessory[] | null;
  pushNav?: () => void;
}) {
  const staffAccessories = useQuery(api.accessories.listAll, staffMode ? {} : "skip");
  const accessories = accessoriesOverride !== undefined ? accessoriesOverride : staffAccessories;
  const settingsMarkup = useQuery(api.accessories.getDefaultMarkup);
  const settingsRate = useQuery(api.accessories.getLaborRate);
  const categoryOrder = useQuery(api.admin.getCategoryOrder) ?? [];
  const markup = settingsMarkup ?? 40;
  const rate = settingsRate ?? 150;

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // In customer mode, show cab type selector immediately on mount
  const [showCabTypeSelector, setShowCabTypeSelector] = useState(!staffMode);
  const [selectedCabType, setSelectedCabType] = useState<string | null>(null);
  const [selectedFitmentMake, setSelectedFitmentMake] = useState<string | null>(null);

  // Browser back button support
  const selectedCategoryRef = useRef(selectedCategory);
  selectedCategoryRef.current = selectedCategory;
  const showCabTypeSelectorRef = useRef(showCabTypeSelector);
  showCabTypeSelectorRef.current = showCabTypeSelector;

  useEffect(() => {
    const handleBrowserBack = () => {
      if (showCabTypeSelectorRef.current) {
        setShowCabTypeSelector(false);
        setPendingCabCategory(null);
      } else if (selectedCategoryRef.current) {
        setSelectedCategory(null);
        setSelectedCabType(null);
        setSelectedFitmentMake(null);
        setSearchQuery("");
      } else {
        onChangeBed();
      }
    };
    window.addEventListener("app-nav-back", handleBrowserBack);
    return () => window.removeEventListener("app-nav-back", handleBrowserBack);
  }, [onChangeBed]);

  // Cab types per truck make for Steps & Running Boards
  const CAB_TYPES: Record<string, string[]> = {
    "Ford": ["Single Cab", "Extended Cab (SuperCab)", "Crew Cab (SuperCrew)"],
    "Ram": ["Single Cab (Regular)", "Crew Cab", "Mega Cab"],
    "Chevy / GMC": ["Single Cab (Regular)", "Extended Cab (Double)", "Crew Cab"],
  };

  // Track which category triggered the cab type selector so we navigate there after selection
  const [pendingCabCategory, setPendingCabCategory] = useState<string | null>(null);

  const handleCategorySelect = (cat: string | null) => {
    if (cat === "Steps & Running Boards" && !selectedCabType && !staffMode) {
      setPendingCabCategory(cat);
      pushNav?.();
      setShowCabTypeSelector(true);
      return;
    }
    if (cat) pushNav?.();
    setSelectedCategory(cat);
  };

  const handleCabTypeSelected = (cabType: string, make?: string, goToCategory?: string) => {
    setSelectedCabType(cabType);
    setSelectedFitmentMake(make || selectedMakeLabel || null);
    setShowCabTypeSelector(false);
    setPendingCabCategory(null);
    if (goToCategory) {
      pushNav?.();
      setSelectedCategory(goToCategory);
    }
  };

  // Hide Rear Bumpers when a bed is selected (bed replaces the bumper)
  const HIDDEN_CATEGORIES_WITH_BED = new Set(["Rear Bumpers"]);

  // Selected truck make label for fitment filtering
  const selectedMakeLabel = truckMake?.label ?? null;

  // Bed types that support underbody boxes
  const UNDERBODY_BED_TYPES = new Set(["Non-Skirted", "Platform"]);
  const showUnderbody = linkedBed ? UNDERBODY_BED_TYPES.has(linkedBed.bedCategory ?? linkedBed.type ?? "") : false;

  const filteredItems = useMemo(() => {
    if (!accessories) return [];
    let items = [...accessories];
    // Hide items with no effective sell price (incomplete data — waiting for Craig's MSRP)
    items = items.filter((i) => getEffectiveSellPrice(i, markup) > 0);
    // Hide categories that don't apply when a bed is selected
    if (linkedBed) {
      items = items.filter((i) => !HIDDEN_CATEGORIES_WITH_BED.has(i.category));
    }
    // Underbody boxes only for non-skirted or platform beds
    if (!showUnderbody) {
      items = items.filter((i) => i.category !== "Underbody Boxes");
    }
    // Filter out truck-specific accessories that don't match selected truck
    if (selectedMakeLabel) {
      items = items.filter(
        (i) => !i.fitmentMakes || i.fitmentMakes.length === 0 || i.fitmentMakes.includes(selectedMakeLabel)
      );
    }
    if (selectedCategory) {
      items = items.filter((i) => i.category === selectedCategory);
    }
    // Filter Steps & Running Boards by cab type using fitment data
    if (selectedCategory === "Steps & Running Boards" && selectedCabType) {
      const filterMake = selectedFitmentMake;
      // Map make-specific cab type names to universal names for matching
      const CAB_TYPE_TO_UNIVERSAL: Record<string, string> = {
        "Single Cab": "Single Cab",
        "Single Cab (Regular)": "Single Cab",
        "Extended Cab (SuperCab)": "Extended Cab",
        "Extended Cab (Double)": "Extended Cab",
        "Crew Cab (SuperCrew)": "Crew Cab",
        "Crew Cab": "Crew Cab",
        "Mega Cab": "Mega Cab",
      };
      const universalCab = CAB_TYPE_TO_UNIVERSAL[selectedCabType] || selectedCabType;
      items = items.filter((i) => {
        const hasDetailedFitment = i.fitment && i.fitment.length > 0;
        const hasUniversalCabs = i.fitmentCabTypes && i.fitmentCabTypes.length > 0;
        // No fitment data at all = universal, show always
        if (!hasDetailedFitment && !hasUniversalCabs) return true;
        // Check universal cab types first (independent of make)
        if (hasUniversalCabs) {
          return i.fitmentCabTypes!.includes(universalCab);
        }
        // Fall back to make-specific fitment
        return i.fitment!.some((f) => {
          const makeMatches = !filterMake || f.make === filterMake;
          const cabMatches = f.cabTypes.includes(selectedCabType!);
          return makeMatches && cabMatches;
        });
      });
    }
    // Filter toolboxes/side packs by CA length compatibility
    if (truckConfig?.caLength) {
      const truckCA = truckConfig.caLength;
      items = items.filter((i) => {
        // Only filter items that have CA lengths tagged (underbody-style)
        if (!i.compatibleCALengths || i.compatibleCALengths.length === 0) return true;
        return i.compatibleCALengths.includes(truckCA);
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.brand.toLowerCase().includes(q) ||
          i.series.toLowerCase().includes(q) ||
          i.partNumber.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          (i.notes && i.notes.toLowerCase().includes(q))
      );
    }
    return items;
  }, [accessories, selectedCategory, searchQuery, linkedBed, selectedMakeLabel, showUnderbody, selectedCabType, selectedFitmentMake, truckConfig]);

  const categories = useMemo(() => {
    if (!accessories) return [];
    let items = [...accessories];
    // Hide items with no effective sell price (incomplete data)
    items = items.filter((i) => getEffectiveSellPrice(i, markup) > 0);
    if (linkedBed) {
      items = items.filter((i) => !HIDDEN_CATEGORIES_WITH_BED.has(i.category));
    }
    // Underbody boxes only for non-skirted or platform beds
    if (!showUnderbody) {
      items = items.filter((i) => i.category !== "Underbody Boxes");
    }
    // Also filter by truck make for category counts
    if (selectedMakeLabel) {
      items = items.filter(
        (i) => !i.fitmentMakes || i.fitmentMakes.length === 0 || i.fitmentMakes.includes(selectedMakeLabel)
      );
    }
    // Filter toolboxes/side packs by CA length compatibility for category counts
    if (truckConfig?.caLength) {
      const truckCA = truckConfig.caLength;
      items = items.filter((i) => {
        if (!i.compatibleCALengths || i.compatibleCALengths.length === 0) return true;
        return i.compatibleCALengths.includes(truckCA);
      });
    }
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.category, (map.get(item.category) || 0) + 1);
    }

    // Use admin-configured category order, fallback to alphabetical
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        const oa = categoryOrder.indexOf(a.name);
        const ob = categoryOrder.indexOf(b.name);
        const ia = oa === -1 ? 999 : oa;
        const ib = ob === -1 ? 999 : ob;
        if (ia !== ib) return ia - ib;
        return a.name.localeCompare(b.name);
      });
  }, [accessories, linkedBed, showUnderbody, selectedMakeLabel, staffMode, truckConfig, categoryOrder]);

  // Each item shows as its own card — no productFamily merging
  const displayItems = useMemo(() => filteredItems, [filteredItems]);

  const grouped = useMemo(() => {
    const unsorted = new Map<string, typeof displayItems>();
    for (const item of displayItems) {
      const group = unsorted.get(item.category) || [];
      group.push(item);
      unsorted.set(item.category, group);
    }
    // Sort by admin-configured category order
    const sorted = new Map<string, typeof displayItems>();
    const entries = Array.from(unsorted.entries()).sort((a, b) => {
      const oa = categoryOrder.indexOf(a[0]);
      const ob = categoryOrder.indexOf(b[0]);
      const ia = oa === -1 ? 999 : oa;
      const ib = ob === -1 ? 999 : ob;
      if (ia !== ib) return ia - ib;
      return a[0].localeCompare(b[0]);
    });
    for (const [k, v] of entries) sorted.set(k, v);
    return sorted;
  }, [displayItems, categoryOrder]);

  return (
    <>
      {/* Back button bar */}
      <div className="bg-muted/40 border-b">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <button
            type="button"
            onClick={onChangeBed}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-foreground bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:scale-[0.98] transition-all shadow-sm"
          >
            <ChevronLeft className="size-4" />
            Back to bed selection
          </button>
        </div>
      </div>

      {/* Context bar — shows truck + bed info at top */}
      <div className="bg-muted/40 border-b">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3 text-sm overflow-x-auto no-scrollbar">
          {truckMake && truckConfig ? (
            <button
              type="button"
              onClick={onChangeTruck}
              className="flex items-center gap-1.5 shrink-0 hover:text-primary transition-colors"
            >
              {truckMake.logoImage ? (
                <img src={truckMake.logoImage} alt={truckMake.label} className="h-4 w-8 object-contain shrink-0" />
              ) : truckMake.LogoComponent ? (
                <truckMake.LogoComponent className="h-4 w-8 shrink-0" />
              ) : (
                <Truck className="size-4" />
              )}
              <span className="font-medium">{truckMake.label}</span>
              <span className="text-muted-foreground">
                {truckConfig.label}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onChangeTruck}
              className="flex items-center gap-1.5 shrink-0 text-muted-foreground hover:text-primary"
            >
              <Truck className="size-4" />
              <span>No truck selected</span>
            </button>
          )}
          {linkedBed ? (
            <>
              <ChevronRight className="size-3 text-muted-foreground shrink-0" />
              <button
                type="button"
                onClick={onChangeBed}
                className="flex items-center gap-1 shrink-0 hover:text-primary transition-colors group"
              >
                <span className="text-muted-foreground truncate max-w-[200px] group-hover:text-primary">
                  {linkedBed.title}
                </span>
                <span className="text-[10px] text-muted-foreground/60 group-hover:text-primary ml-1">(change)</span>
              </button>
            </>
          ) : truckMake && truckConfig ? (
            <>
              <ChevronRight className="size-3 text-muted-foreground shrink-0" />
              <button
                type="button"
                onClick={onChangeBed}
                className="flex items-center gap-1 shrink-0 text-muted-foreground hover:text-primary transition-colors"
              >
                <span>No bed selected</span>
                <span className="text-[10px] opacity-60">(add)</span>
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Search + categories */}
      <div className="sticky top-14 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by brand, part #, or description…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <CategoryNav
            categories={categories}
            selected={selectedCategory}
            onSelect={handleCategorySelect}
          />
        </div>
      </div>

      {/* Accessory grid */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="size-12 mx-auto mb-3 opacity-30" />
            <>
              <p className="text-lg font-medium">No items found</p>
              <p className="text-sm mt-1">Try a different search or category</p>
            </>
          </div>
        ) : (
          <div className="space-y-8">
            {Array.from(grouped.entries()).map(([category, items]) => (
              <section key={category}>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-bold">{displayCategoryName(category)}</h2>
                  <Badge variant="secondary" className="text-xs">
                    {items.length}
                  </Badge>
                  {category === "Steps & Running Boards" && selectedCabType && (
                    <button
                      type="button"
                      onClick={() => { setSelectedCabType(null); setSelectedFitmentMake(null); setShowCabTypeSelector(true); }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200 transition-colors"
                    >
                      🚛 {selectedFitmentMake && !selectedMakeLabel ? `${selectedFitmentMake} — ` : ""}{selectedCabType}
                      <X className="size-3" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map((item) => (
                    <AccessoryCard
                      key={item._id}
                      item={item as Accessory}
                      laborRate={rate}
                      defaultMarkup={markup}
                      onAddToQuote={onAddToQuote}
                      showCost={showCost}
                      staffMode={staffMode}
                      truckMake={selectedMakeLabel}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-12 pt-6 border-t text-center text-xs text-muted-foreground space-y-1">
          {staffMode ? (
            <p>
              {filteredItems.length} accessories across {grouped.size} categories •
              Labor rate: ${rate}/hr • Default markup: {markup}%
            </p>
          ) : (
            <p>
              {filteredItems.length} accessories across {grouped.size} categories
            </p>
          )}
          <p>
            Prices are for reference. Final quotes may vary by
            vehicle and configuration.
          </p>
          <p className="text-[10px] opacity-50">
            Star Truck Equipment — Wharton, TX • (979) 532-1486
          </p>
        </div>
      </main>

      {/* Cab Type Selector for Steps & Running Boards */}
      {showCabTypeSelector && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
             onClick={() => { if (selectedCabType || pendingCabCategory) setShowCabTypeSelector(false); }}>
          <div className="bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4"
               onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">🚛 Select Your Cab Type</h3>
            <p className="text-sm text-muted-foreground">
              Some accessories are sized by cab type. Select yours so we show you the right parts:
            </p>
            {selectedMakeLabel && CAB_TYPES[selectedMakeLabel] ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{selectedMakeLabel}</p>
                {CAB_TYPES[selectedMakeLabel].map((ct) => (
                  <button
                    key={ct}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-all text-left"
                    onClick={() => handleCabTypeSelected(ct, selectedMakeLabel!, pendingCabCategory ?? undefined)}
                  >
                    <span className="font-medium text-sm">{ct}</span>
                  </button>
                ))}
              </div>
            ) : (
              // No truck selected or generic — show all makes
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {Object.entries(CAB_TYPES).map(([make, types]) => (
                  <div key={make} className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{make}</p>
                    {types.map((ct) => (
                      <button
                        key={ct}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-all text-left"
                        onClick={() => handleCabTypeSelected(ct, make, pendingCabCategory ?? undefined)}
                      >
                        <span className="font-medium text-sm">{ct}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <button
              className="w-full p-3 rounded-lg border text-sm text-muted-foreground hover:bg-accent/50"
              onClick={() => {
                setShowCabTypeSelector(false);
                if (pendingCabCategory) {
                  setSelectedCategory(pendingCabCategory);
                  setPendingCabCategory(null);
                }
              }}
            >
              Skip — I'll choose later
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export function SalesToolPage({ staffMode = false }: { staffMode?: boolean } = {}) {
  // ── App state ──
  type AppStep = "truck" | "bed" | "accessories";
  const [step, setStep] = useState<AppStep>("truck");
  const [truckMake, setTruckMake] = useState<TruckMake | null>(null);
  const [truckConfig, setTruckConfig] = useState<TruckConfig | null>(null);
  const [linkedBed, setLinkedBed] = useState<InventoryItem | null>(null);
  const [isCustomOrder, setIsCustomOrder] = useState(false);
  const [customOrderBedStyle, setCustomOrderBedStyle] = useState<string | null>(null);
  const [customOrderBrand, setCustomOrderBrand] = useState<string | null>(null);

  // ── Quote state ──
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [showCost, setShowCost] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [bedInstallEnabled, setBedInstallEnabled] = useState(true);
  const [bedInstallPrice, setBedInstallPrice] = useState(1500);
  const [pumpPromptOpen, setPumpPromptOpen] = useState(false);
  const [tankPromptOpen, setTankPromptOpen] = useState(false);
  const [filterKitPromptOpen, setFilterKitPromptOpen] = useState(false);
  const [underbodySidePromptOpen, setUnderbodySidePromptOpen] = useState(false);
  const [pendingUnderbodyItem, setPendingUnderbodyItem] = useState<Accessory | null>(null);
  const [filterKitPumpBrand, setFilterKitPumpBrand] = useState<string | null>(null);
  const [quoteRequested, setQuoteRequested] = useState(false);

  // ── Customer info ──
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [selectedSalesperson, setSelectedSalesperson] = useState<Salesperson | null>(null);

  // ── Convex ── (use customer-safe query when not in staff mode)
  const allAccessoriesStaff = useQuery(api.accessories.listAll, staffMode ? {} : "skip");
  const allAccessoriesCustomer = useQuery(api.accessories.listAllCustomer, !staffMode ? {} : "skip");
  const allAccessories = staffMode ? allAccessoriesStaff : (allAccessoriesCustomer as typeof allAccessoriesStaff);
  const settingsMarkup = useQuery(api.accessories.getDefaultMarkup);
  const settingsRate = useQuery(api.accessories.getLaborRate);
  const markup = settingsMarkup ?? 40;
  const rate = settingsRate ?? 150;
  const createQuote = useMutation(api.quotes.createQuote);

  // ── Browser history for back button support ──
  // We push a history entry on every forward navigation. On popstate,
  // we dispatch a custom "app-nav-back" event that child components listen to.
  const pushNav = useCallback(() => {
    window.history.pushState({ appNav: true }, "");
  }, []);

  useEffect(() => {
    const onPopState = () => {
      window.dispatchEvent(new CustomEvent("app-nav-back"));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // ── Handlers ──
  const handleSelectTruck = useCallback(
    (make: TruckMake, config: TruckConfig) => {
      setTruckMake(make);
      setTruckConfig(config);
      pushNav();
      setStep("bed");
    },
    [pushNav]
  );

  const handleSkipTruck = useCallback(() => {
    setTruckMake(null);
    setTruckConfig(null);
    setLinkedBed(null);
    pushNav();
    setStep("accessories");
  }, [pushNav]);

  const handleSelectBed = useCallback((bed: InventoryItem) => {
    setLinkedBed(bed);
    // Hay spike beds get $1,800 installation; all others default $1,500
    if (bed.hasHaySpike) {
      setBedInstallPrice(1800);
    } else {
      setBedInstallPrice(1500);
    }
    pushNav();
    setStep("accessories");
  }, [pushNav]);

  const handleSkipBed = useCallback(() => {
    setLinkedBed(null);
    pushNav();
    setStep("accessories");
  }, [pushNav]);

  const handleChangeTruck = useCallback(() => {
    setStep("truck");
    setIsCustomOrder(false);
  }, []);

  const handleChangeBed = useCallback(() => {
    setStep("bed");
    setIsCustomOrder(false);
  }, []);

  // Categories that trigger the "add a transfer pump?" prompt
  const FUEL_CATEGORIES = new Set(["Transfer Tanks", "Tank/Toolbox Combos"]);

  const addUnderbodyToQuote = useCallback((item: Accessory, side: "driver" | "passenger" | "both") => {
    setQuoteItems((prev) => {
      // Count existing underbody boxes
      const existingUnderbody = prev.filter((qi) => qi.accessory.compatibleCALengths && qi.accessory.compatibleCALengths.length > 0);
      const totalUnderbodyQty = existingUnderbody.reduce((sum, qi) => sum + qi.quantity, 0);

      if (side === "both") {
        // Adding 2 — check we don't exceed 2 total
        if (totalUnderbodyQty >= 2) {
          setTimeout(() => toast.error("Maximum of 2 underbody toolboxes allowed"), 0);
          return prev;
        }
        if (totalUnderbodyQty === 1) {
          setTimeout(() => toast.error("Only 1 more underbody toolbox spot available — select one side"), 0);
          return prev;
        }
        setTimeout(() => toast.success("Added 2 underbody toolboxes (driver + passenger)"), 0);
        return [...prev, { accessory: item, quantity: 2, mountSide: "both" }];
      } else {
        // Adding 1 to a specific side
        if (totalUnderbodyQty >= 2) {
          setTimeout(() => toast.error("Maximum of 2 underbody toolboxes allowed"), 0);
          return prev;
        }
        // Check if same side already taken
        const sameSide = existingUnderbody.find(
          (qi) => qi.mountSide === side || qi.mountSide === "both"
        );
        if (sameSide) {
          setTimeout(() => toast.error(`${side === "driver" ? "Driver" : "Passenger"}'s side already has a toolbox`), 0);
          return prev;
        }
        setTimeout(() => toast.success(`Added to ${side === "driver" ? "driver" : "passenger"}'s side`), 0);
        return [...prev, { accessory: item, quantity: 1, mountSide: side }];
      }
    });
  }, []);

  const addToQuote = useCallback((item: Accessory) => {
    // Underbody boxes (items with CA lengths) — prompt for side selection
    if (item.compatibleCALengths && item.compatibleCALengths.length > 0) {
      // Check if already at max (any items with CA lengths = underbody-style)
      const existingUnderbody = quoteItems.filter((qi) => qi.accessory.compatibleCALengths && qi.accessory.compatibleCALengths.length > 0);
      const totalQty = existingUnderbody.reduce((sum, qi) => sum + qi.quantity, 0);
      if (totalQty >= 2) {
        toast.error("Maximum of 2 underbody toolboxes allowed");
        return;
      }
      setPendingUnderbodyItem(item);
      setUnderbodySidePromptOpen(true);
      return;
    }

    // Bumper / grille guard mutual exclusivity — customer can pick one or the other
    const MUTUALLY_EXCLUSIVE: Record<string, string> = {
      "Front Bumpers": "Grille Guards",
      "Grille Guards": "Front Bumpers",
    };
    const conflictCat = MUTUALLY_EXCLUSIVE[item.category];

    setQuoteItems((prev) => {
      let next = prev;
      // Remove conflicting category if present
      if (conflictCat) {
        const hasConflict = prev.some((qi) => qi.accessory.category === conflictCat);
        if (hasConflict) {
          next = prev.filter((qi) => qi.accessory.category !== conflictCat);
          // Schedule toast outside of setState to avoid React warnings
          setTimeout(() => toast(`Replaced ${conflictCat.toLowerCase()} — you can have one or the other`, { icon: "🔄" }), 0);
        } else {
          setTimeout(() => toast.success("Added to quote"), 0);
        }
      } else {
        setTimeout(() => toast.success("Added to quote"), 0);
      }
      const existing = next.find((qi) => qi.accessory._id === item._id);
      if (existing) {
        return next.map((qi) =>
          qi.accessory._id === item._id
            ? { ...qi, quantity: qi.quantity + 1 }
            : qi
        );
      }
      return [...next, { accessory: item, quantity: 1 }];
    });
    // Prompt for transfer pump when adding a fuel tank or combo
    if (FUEL_CATEGORIES.has(item.category)) {
      setPumpPromptOpen(true);
    }
    // Prompt for fuel tank when adding a transfer pump — but NOT if they already have a tank or combo
    if (item.category === "Transfer Pumps") {
      setQuoteItems((current) => {
        const hasTank = current.some((qi) =>
          qi.accessory.category === "Transfer Tanks" || qi.accessory.category === "Tank/Toolbox Combos"
        );
        if (!hasTank) setTankPromptOpen(true);
        return current; // no mutation
      });
      // Also prompt for fuel filter kit — match brand to pump brand
      setFilterKitPumpBrand(item.brand || null);
      setQuoteItems((current) => {
        const hasFilter = current.some((qi) =>
          qi.accessory.series?.toLowerCase().includes("fuel filter") ||
          qi.accessory.series?.toLowerCase().includes("filter kit")
        );
        if (!hasFilter) setFilterKitPromptOpen(true);
        return current; // no mutation
      });
    }
  }, [quoteItems]);

  const updateQty = useCallback((id: string, qty: number) => {
    setQuoteItems((prev) =>
      prev.map((qi) =>
        qi.accessory._id === id ? { ...qi, quantity: qty } : qi
      )
    );
  }, []);

  const updatePrice = useCallback((id: string, price: number | undefined) => {
    setQuoteItems((prev) =>
      prev.map((qi) =>
        qi.accessory._id === id
          ? { ...qi, customSellPrice: price, customMarkup: undefined }
          : qi
      )
    );
  }, []);

  const updateMarkup = useCallback(
    (id: string, markupPct: number | undefined) => {
      setQuoteItems((prev) =>
        prev.map((qi) =>
          qi.accessory._id === id
            ? { ...qi, customMarkup: markupPct, customSellPrice: undefined }
            : qi
        )
      );
    },
    []
  );

  const removeFromQuote = useCallback((id: string) => {
    setQuoteItems((prev) => prev.filter((qi) => qi.accessory._id !== id));
  }, []);

  const getQuoteItemPrice = useCallback(
    (qi: QuoteItem) => {
      if (qi.customSellPrice !== undefined) return qi.customSellPrice;
      if (qi.customMarkup !== undefined) {
        return Math.round(qi.accessory.cost * (1 + qi.customMarkup / 100));
      }
      return getEffectiveSellPrice(qi.accessory, markup);
    },
    [markup]
  );

  // Shared quote creation logic
  const createSharedQuote = useCallback(async () => {
    const slug = await createQuote({
      items: quoteItems.map((qi) => ({
        brand: qi.accessory.brand,
        series: qi.accessory.series,
        partNumber: qi.accessory.partNumber,
        category: qi.accessory.category,
        unitPrice: getQuoteItemPrice(qi),
        quantity: qi.quantity,
        installHours: qi.accessory.installHours ?? 0,
      })),
      laborRate: rate,
      ...(truckMake ? { truckMake: truckMake.label } : {}),
      ...(truckConfig ? { truckConfig: truckConfig.label } : {}),
      ...(linkedBed
        ? {
            inventoryUrl: linkedBed.url,
            inventoryTitle: linkedBed.title,
            inventoryPrice: linkedBed.salePrice || linkedBed.price,
          }
        : {}),
      ...(isCustomOrder ? { isCustomOrder: true } : {}),
    });
    const quoteUrl = `${window.location.origin}/quote/${slug}`;
    const estNum = slug.toUpperCase();
    // Calculate total for the message
    const bp = linkedBed ? ((linkedBed.salePrice ?? linkedBed.price) ?? 0) : 0;
    const partsSubtotal = quoteItems.reduce((s, qi) => s + getQuoteItemPrice(qi) * qi.quantity, 0);
    const instHrs = quoteItems.reduce((s, qi) => s + (qi.accessory.installHours ?? 0) * qi.quantity, 0);
    const instTotal = instHrs * rate;
    const scTotal = truckConfig?.surcharges?.reduce((s, c) => s + c.amount, 0) ?? 0;
    const gt = bp + partsSubtotal + instTotal + scTotal;
    return { quoteUrl, estNum, gt };
  }, [quoteItems, rate, createQuote, getQuoteItemPrice, linkedBed, truckMake, truckConfig, isCustomOrder]);

  const handleShareEmail = useCallback(async () => {
    if (quoteItems.length === 0 && !linkedBed) {
      toast.error("Add items or select a bed first");
      return;
    }
    setShareLoading(true);
    try {
      const { quoteUrl, estNum } = await createSharedQuote();
      const to = customerEmail ? encodeURIComponent(customerEmail) : "";
      const subject = encodeURIComponent(`Star Truck Equipment — Estimate ${estNum}`);
      const name = customerName || "there";
      const spName = selectedSalesperson?.name ?? "";
      const spPhone = selectedSalesperson?.phone ?? "";
      const body = encodeURIComponent(
        `Hi ${name},\n\nHere's your estimate from Star Truck Equipment.\n\nView your quote online:\n${quoteUrl}\n\nIf you have any questions, feel free to reach out.\n\n${spName}${spPhone ? `\n${spPhone}` : ""}\nStar Truck Equipment\n979-282-6061`
      );
      window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_self");
      try { await navigator.clipboard.writeText(quoteUrl); } catch {}
      toast.success("Quote link copied!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create quote");
    } finally {
      setShareLoading(false);
    }
  }, [quoteItems, linkedBed, createSharedQuote, customerEmail, customerName, selectedSalesperson]);

  const handleShareText = useCallback(async () => {
    if (quoteItems.length === 0 && !linkedBed) {
      toast.error("Add items or select a bed first");
      return;
    }
    setShareLoading(true);
    try {
      const { quoteUrl, estNum } = await createSharedQuote();
      const name = customerName || "";
      const spName = selectedSalesperson?.name ?? "Star Truck Equipment";
      const msg = `${name ? `Hi ${name}, ` : ""}Here's your estimate (${estNum}) from Star Truck Equipment.\n\nView your quote: ${quoteUrl}\n\n— ${spName}`;
      const phone = customerPhone ? customerPhone.replace(/\D/g, "") : "";
      // Use sms: URI — works on both iOS and Android
      const smsUrl = phone
        ? `sms:${phone}${/iPhone|iPad|iPod/i.test(navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(msg)}`
        : `sms:${/iPhone|iPad|iPod/i.test(navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(msg)}`;
      window.open(smsUrl, "_self");
      try { await navigator.clipboard.writeText(quoteUrl); } catch {}
      toast.success("Quote link copied!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create quote");
    } finally {
      setShareLoading(false);
    }
  }, [quoteItems, linkedBed, createSharedQuote, customerName, customerPhone, selectedSalesperson]);

  // ── See Quote (customer mode) — creates quote and redirects to quote page ──
  const handleRequestQuote = useCallback(async () => {
    if (quoteItems.length === 0 && !linkedBed) {
      toast.error("Add items or select a bed first");
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || !customerEmail.trim()) {
      toast.error("Please enter your name, phone, and email");
      return;
    }
    setShareLoading(true);
    try {
      const slug = await createQuote({
        items: quoteItems.map((qi) => ({
          brand: qi.accessory.brand,
          series: qi.accessory.series,
          partNumber: qi.accessory.partNumber,
          category: qi.accessory.category,
          unitPrice: getEffectiveSellPrice(qi.accessory, markup),
          quantity: qi.quantity,
          installHours: qi.accessory.installHours ?? 0,
        })),
        laborRate: rate,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        customerEmail: customerEmail || undefined,
        ...(truckMake ? { truckMake: truckMake.label } : {}),
        ...(truckConfig ? { truckConfig: truckConfig.label } : {}),
        ...(linkedBed
          ? {
              inventoryUrl: linkedBed.url,
              inventoryTitle: linkedBed.title,
              inventoryPrice: linkedBed.salePrice || linkedBed.price,
            }
          : {}),
        notes: isCustomOrder
          ? `Custom order quote request from Quote Builder${customOrderBedStyle ? ` — Bed style: ${customOrderBedStyle}` : ""}${customOrderBrand ? ` — Preferred brand: ${customOrderBrand}` : ""}`
          : "Customer quote request from Quote Builder",
        ...(isCustomOrder ? { isCustomOrder: true } : {}),
      });
      // Redirect to the quote view page
      window.location.href = `/quote/${slug}`;
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please call us at (979) 282-6061");
      setShareLoading(false);
    }
  }, [quoteItems, linkedBed, createQuote, markup, rate, customerName, customerPhone, customerEmail, truckMake, truckConfig, isCustomOrder]);

  const quoteCount = quoteItems.reduce((s, qi) => s + qi.quantity, 0) + (linkedBed ? 1 : 0);

  // ── Render ──
  return (
    <div className="min-h-screen bg-background">
      {/* Header — always visible */}
      <header className="sticky top-0 z-40 border-b bg-[#1a1a1a] text-white">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTruckMake(null);
                  setTruckConfig(null);
                  setLinkedBed(null);
                  setQuoteItems([]);
                  setBedInstallEnabled(true);
                  setQuoteRequested(false);
                  setIsCustomOrder(false);
                }}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                title="Start over"
              >
                <img src="/images/ste-logo-header.webp" alt="Star Truck Equipment" className="h-9 object-contain" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Cost toggle (internal — staff only) */}
            {staffMode && (
              <button
                type="button"
                onClick={() => setShowCost(!showCost)}
                className={`p-2 rounded-md transition-colors ${showCost ? "bg-amber-900/30 text-amber-400" : "text-gray-400 hover:text-white"}`}
                title="Toggle cost view"
              >
                <Tag className="size-4" />
              </button>
            )}

            {/* Quote badge — header icon for staff, hidden in customer mode (bottom bar used instead) */}
            {staffMode && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="relative gap-1.5 border-gray-600 text-gray-200 hover:bg-white/10 hover:text-white">
                  <FileText className="size-4" />
                  {quoteCount > 0 && (
                    <span className="text-xs font-bold tabular-nums">{quoteCount}</span>
                  )}
                  {quoteCount > 0 && (
                    <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-green-500 animate-pulse" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:w-[420px]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <FileText className="size-5" />
                    Quick Quote
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4 h-[calc(100vh-120px)]">
                  {quoteRequested && !staffMode ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center px-6 py-8">
                        <div className="size-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                          <Check className="size-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Quote Request Submitted!</h3>
                        <p className="text-muted-foreground mb-4">
                          Thanks{customerName ? `, ${customerName}` : ""}! Our team will review your selections and get back to you with a detailed quote.
                        </p>
                        <p className="text-sm text-muted-foreground mb-6">
                          Questions? Call us at <a href="tel:9792826061" className="font-semibold text-primary">(979) 282-6061</a>
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setQuoteRequested(false);
                            setQuoteItems([]);
                            setCustomerName("");
                            setCustomerPhone("");
                            setCustomerEmail("");
                          }}
                        >
                          Start New Quote
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <QuotePanel
                      items={quoteItems}
                      laborRate={rate}
                      defaultMarkup={markup}
                      linkedBed={linkedBed}
                      truckMake={truckMake}
                      truckConfig={truckConfig}
                      bedInstallPrice={bedInstallPrice}
                      bedInstallEnabled={bedInstallEnabled}
                      onToggleBedInstall={() => setBedInstallEnabled((v) => !v)}
                      onUpdateBedInstallPrice={setBedInstallPrice}
                      onUpdateQty={updateQty}
                      onUpdatePrice={updatePrice}
                      onUpdateMarkup={updateMarkup}
                      onRemove={removeFromQuote}
                      onClear={() => setQuoteItems([])}
                      onShareEmail={handleShareEmail}
                      onShareText={handleShareText}
                      onClearBed={() => setLinkedBed(null)}
                      shareLoading={shareLoading}
                      customerName={customerName}
                      customerPhone={customerPhone}
                      customerEmail={customerEmail}
                      selectedSalesperson={selectedSalesperson}
                      onCustomerNameChange={setCustomerName}
                      onCustomerPhoneChange={setCustomerPhone}
                      onCustomerEmailChange={setCustomerEmail}
                      onSalespersonChange={setSelectedSalesperson}
                      staffMode={staffMode}
                      onRequestQuote={handleRequestQuote}
                      isCustomOrder={isCustomOrder}
                      customOrderBedStyle={customOrderBedStyle}
                      customOrderBrand={customOrderBrand}
                    />
                  )}
                </div>
              </SheetContent>
            </Sheet>
            )}

            {/* Customer mode: quote button removed — bottom bar only */}
          </div>
        </div>
      </header>

      {/* Customer mode: sticky bottom quote bar */}
      {!staffMode && step === "accessories" && quoteCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1a1a] border-t border-gray-700 shadow-2xl safe-bottom">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-white">
              <div className="size-10 rounded-full bg-[#dd6923] flex items-center justify-center">
                <span className="text-sm font-bold">{quoteCount}</span>
              </div>
              <div>
                <div className="font-semibold text-sm">
                  {quoteCount} item{quoteCount !== 1 ? "s" : ""} in your quote
                </div>
                {linkedBed && (
                  <div className="text-xs text-gray-400 truncate max-w-[200px]">{linkedBed.title}</div>
                )}
              </div>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="bg-[#dd6923] hover:bg-[#c55d1f] text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors flex items-center gap-2 shadow-lg"
                >
                  <FileText className="size-4" />
                  View Your Quote
                </button>
              </SheetTrigger>
              <SheetContent className="w-full sm:w-[420px]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <FileText className="size-5" />
                    Your Quote
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4 h-[calc(100vh-120px)]">
                  {quoteRequested ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center px-6 py-8">
                        <div className="size-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                          <Check className="size-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Quote Request Submitted!</h3>
                        <p className="text-sm text-muted-foreground">We'll be in touch shortly at the contact info you provided.</p>
                      </div>
                    </div>
                  ) : (
                    <QuotePanel
                      items={quoteItems}
                      laborRate={rate}
                      defaultMarkup={markup}
                      linkedBed={linkedBed}
                      truckMake={truckMake}
                      truckConfig={truckConfig}
                      bedInstallPrice={bedInstallPrice}
                      bedInstallEnabled={bedInstallEnabled}
                      onToggleBedInstall={() => setBedInstallEnabled((v) => !v)}
                      onUpdateBedInstallPrice={setBedInstallPrice}
                      onUpdateQty={updateQty}
                      onUpdatePrice={updatePrice}
                      onUpdateMarkup={updateMarkup}
                      onRemove={removeFromQuote}
                      onClear={() => setQuoteItems([])}
                      onShareEmail={handleShareEmail}
                      onShareText={handleShareText}
                      onClearBed={() => setLinkedBed(null)}
                      shareLoading={shareLoading}
                      customerName={customerName}
                      customerPhone={customerPhone}
                      customerEmail={customerEmail}
                      selectedSalesperson={selectedSalesperson}
                      onCustomerNameChange={setCustomerName}
                      onCustomerPhoneChange={setCustomerPhone}
                      onCustomerEmailChange={setCustomerEmail}
                      onSalespersonChange={setSelectedSalesperson}
                      staffMode={false}
                      onRequestQuote={handleRequestQuote}
                      isCustomOrder={isCustomOrder}
                      customOrderBedStyle={customOrderBedStyle}
                      customOrderBrand={customOrderBrand}
                    />
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      )}

      {/* Step content */}
      {step === "truck" && (
        <TruckSelector
          onSelect={handleSelectTruck}
          onSkip={handleSkipTruck}
          staffMode={staffMode}
        />
      )}

      {step === "bed" && truckMake && truckConfig && (
        <BedPicker
          make={truckMake}
          config={truckConfig}
          onSelectBed={handleSelectBed}
          onSkip={handleSkipBed}
          onBack={handleChangeTruck}
          onCustomOrder={(bedStyle?: string, brand?: string) => {
            setIsCustomOrder(true);
            setCustomOrderBedStyle(bedStyle ?? null);
            setCustomOrderBrand(brand ?? null);
            setLinkedBed(null);
            pushNav();
            setStep("accessories");
          }}
          staffMode={staffMode}
          pushNav={pushNav}
        />
      )}

      {step === "accessories" && (
        <AccessoriesCatalog
          truckMake={truckMake}
          truckConfig={truckConfig}
          linkedBed={linkedBed}
          onAddToQuote={addToQuote}
          onChangeTruck={handleChangeTruck}
          onChangeBed={handleChangeBed}
          showCost={staffMode ? showCost : false}
          staffMode={staffMode}
          accessoriesOverride={!staffMode ? allAccessories : undefined}
          pushNav={pushNav}
        />
      )}

      {/* Transfer Pump prompt — appears when a fuel tank/combo is added */}
      {pumpPromptOpen && (() => {
        const pumps = (allAccessories ?? []).filter((a: Accessory) => a.category === "Transfer Pumps");
        return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
             onClick={() => setPumpPromptOpen(false)}>
          <div className="bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-lg p-6 space-y-4"
               onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">⛽ Add a Transfer Pump?</h3>
            <p className="text-sm text-muted-foreground">
              Fuel tanks don't include a pump. Would you like to add one?
            </p>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {pumps.map((pump: Accessory) => {
                  const sell = pump.sellPrice ?? Math.round(pump.cost * (1 + markup / 100));
                  const thumbUrl = pump.images?.find((img) => img.isPrimary)?.url
                    || pump.images?.[0]?.url || pump.imageUrl;
                  return (
                    <button
                      key={pump._id}
                      className="w-full flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 hover:border-primary/30 transition-all text-left"
                      onClick={() => {
                        addToQuote(pump);
                        setPumpPromptOpen(false);
                      }}
                    >
                      {thumbUrl ? (
                        <img src={thumbUrl} alt={pump.series}
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border">
                          <span className="text-2xl">⛽</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{pump.brand} {pump.series}</p>
                        {pump.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{pump.notes}</p>
                        )}
                        {pump.partNumber && (
                          <p className="text-[11px] text-muted-foreground/70 mt-0.5">Part# {pump.partNumber}</p>
                        )}
                      </div>
                      <span className="font-bold text-sm whitespace-nowrap text-primary">${sell.toLocaleString()}</span>
                    </button>
                  );
                })}
            </div>
            <button
              className="w-full p-3 rounded-lg border text-sm text-muted-foreground hover:bg-accent/50"
              onClick={() => setPumpPromptOpen(false)}
            >
              No thanks — skip pump
            </button>
          </div>
        </div>
        );
      })()}

      {/* Tank prompt — shown when adding a transfer pump */}
      {tankPromptOpen && (() => {
        const tanks = (allAccessories ?? [])
          .filter((a: Accessory) => a.category === "Transfer Tanks" || a.category === "Tank/Toolbox Combos")
          .filter((a: Accessory) => {
            const sell = a.sellPrice ?? Math.round(a.cost * (1 + markup / 100));
            return sell > 0;
          });
        return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
             onClick={() => setTankPromptOpen(false)}>
          <div className="bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-lg p-6 space-y-4"
               onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">⛽ Add a Fuel Tank?</h3>
            <p className="text-sm text-muted-foreground">
              Transfer pumps require a fuel tank or tank/toolbox combo. Select one below:
            </p>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {tanks.map((tank: Accessory) => {
                  const sell = tank.sellPrice ?? Math.round(tank.cost * (1 + markup / 100));
                  const thumbUrl = tank.images?.find((img) => img.isPrimary)?.url
                    || tank.images?.[0]?.url || tank.imageUrl;
                  return (
                    <button
                      key={tank._id}
                      className="w-full flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 hover:border-primary/30 transition-all text-left"
                      onClick={() => {
                        addToQuote(tank);
                        setTankPromptOpen(false);
                      }}
                    >
                      {thumbUrl ? (
                        <img src={thumbUrl} alt={tank.series}
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border">
                          <span className="text-2xl">⛽</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{tank.brand} {tank.series}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{displayCategoryName(tank.category)}</p>
                        {tank.notes && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-2">{tank.notes}</p>
                        )}
                        {tank.partNumber && (
                          <p className="text-[11px] text-muted-foreground/70 mt-0.5">Part# {tank.partNumber}</p>
                        )}
                      </div>
                      <span className="font-bold text-sm whitespace-nowrap text-primary">${sell.toLocaleString()}</span>
                    </button>
                  );
                })}
            </div>
            <button
              className="w-full p-3 rounded-lg border text-sm text-muted-foreground hover:bg-accent/50"
              onClick={() => setTankPromptOpen(false)}
            >
              No thanks — skip tank
            </button>
          </div>
        </div>
        );
      })()}

      {/* Fuel Filter Kit prompt — shown when adding a transfer pump, matched by brand */}
      {/* Underbody Toolbox Side Selection */}
      {underbodySidePromptOpen && pendingUnderbodyItem && (() => {
        const existingUnderbody = quoteItems.filter((qi) => qi.accessory.compatibleCALengths && qi.accessory.compatibleCALengths.length > 0);
        const totalQty = existingUnderbody.reduce((sum, qi) => sum + qi.quantity, 0);
        const spotsLeft = 2 - totalQty;
        const driverTaken = existingUnderbody.some((qi) => qi.mountSide === "driver" || qi.mountSide === "both");
        const passengerTaken = existingUnderbody.some((qi) => qi.mountSide === "passenger" || qi.mountSide === "both");
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
               onClick={() => { setUnderbodySidePromptOpen(false); setPendingUnderbodyItem(null); }}>
            <div className="bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4"
                 onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold">📐 Which side of the truck?</h3>
              <p className="text-sm text-muted-foreground">
                Select where to mount the <span className="font-medium">{pendingUnderbodyItem.brand} {pendingUnderbodyItem.series}</span>:
              </p>
              <div className="space-y-2">
                {!driverTaken && (
                  <button
                    className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-accent/50 transition-all text-left"
                    onClick={() => {
                      addUnderbodyToQuote(pendingUnderbodyItem, "driver");
                      setUnderbodySidePromptOpen(false);
                      setPendingUnderbodyItem(null);
                    }}
                  >
                    <span className="text-2xl">🚛</span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Driver&apos;s Side</p>
                      <p className="text-xs text-muted-foreground">Left side of the truck</p>
                    </div>
                  </button>
                )}
                {!passengerTaken && (
                  <button
                    className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-accent/50 transition-all text-left"
                    onClick={() => {
                      addUnderbodyToQuote(pendingUnderbodyItem, "passenger");
                      setUnderbodySidePromptOpen(false);
                      setPendingUnderbodyItem(null);
                    }}
                  >
                    <span className="text-2xl">🚛</span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Passenger&apos;s Side</p>
                      <p className="text-xs text-muted-foreground">Right side of the truck</p>
                    </div>
                  </button>
                )}
                {spotsLeft >= 2 && !driverTaken && !passengerTaken && (
                  <button
                    className="w-full flex items-center gap-3 p-4 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all text-left"
                    onClick={() => {
                      addUnderbodyToQuote(pendingUnderbodyItem, "both");
                      setUnderbodySidePromptOpen(false);
                      setPendingUnderbodyItem(null);
                    }}
                  >
                    <span className="text-2xl">🔧</span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Both Sides</p>
                      <p className="text-xs text-muted-foreground">One on driver&apos;s + one on passenger&apos;s side</p>
                    </div>
                  </button>
                )}
              </div>
              <button
                className="w-full p-3 rounded-lg border text-sm text-muted-foreground hover:bg-accent/50"
                onClick={() => { setUnderbodySidePromptOpen(false); setPendingUnderbodyItem(null); }}
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })()}

      {filterKitPromptOpen && (() => {
        const allFilterKits = (allAccessories ?? []).filter(
          (a: Accessory) =>
            a.series?.toLowerCase().includes("fuel filter") ||
            a.series?.toLowerCase().includes("filter kit")
        );
        // Show matching brand first; if pump brand matches a kit brand, only show that one
        const brandMatch = filterKitPumpBrand
          ? allFilterKits.filter((a) => a.brand?.toLowerCase() === filterKitPumpBrand.toLowerCase())
          : [];
        const filterKits = brandMatch.length > 0 ? brandMatch : allFilterKits;
        if (filterKits.length === 0) return null;
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
               onClick={() => setFilterKitPromptOpen(false)}>
            <div className="bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4"
                 onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold">🔧 Add a Fuel Filter Kit?</h3>
              <p className="text-sm text-muted-foreground">
                Most customers add a {filterKitPumpBrand ?? ""} fuel filter kit with their transfer pump to keep fuel clean and extend pump life.
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filterKits.map((kit: Accessory) => {
                  const sell = kit.sellPrice ?? Math.round(kit.cost * (1 + markup / 100));
                  const installCost = kit.installHours && kit.installHours > 0 ? kit.installHours * rate : 0;
                  const totalPrice = sell + installCost;
                  return (
                    <button
                      key={kit._id}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-all text-left"
                      onClick={() => {
                        addToQuote(kit);
                        setFilterKitPromptOpen(false);
                      }}
                    >
                      {kit.imageUrl && (
                        <img src={kit.imageUrl} alt={kit.series} className="w-12 h-12 object-contain rounded" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-sm">{kit.brand} {kit.series}</p>
                        {kit.notes && <p className="text-xs text-muted-foreground">{kit.notes}</p>}
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-sm">${totalPrice.toLocaleString()}</span>
                        {installCost > 0 && <p className="text-[10px] text-muted-foreground">installed</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                className="w-full p-3 rounded-lg border text-sm text-muted-foreground hover:bg-accent/50"
                onClick={() => setFilterKitPromptOpen(false)}
              >
                No thanks — skip filter kit
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
