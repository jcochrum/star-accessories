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
  Share2,
  Truck,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  SkipForward,
  Download,
} from "lucide-react";
import { FordLogo, RamLogo, ChevyLogo } from "@/components/TruckLogos";
import { useCallback, useMemo, useState } from "react";
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
  maxQty?: number;
  imageUrl?: string;
  fitmentMakes?: string[];  // If set, only show for matching truck make
  source: string;
  notes?: string;
  sortOrder: number;
};

type QuoteItem = {
  accessory: Accessory;
  quantity: number;
  customSellPrice?: number;
  customMarkup?: number;
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
  fitmentTags?: string[];
  hasHaySpike?: boolean;
  status: string;
};

// ─── Fitment configuration (mirrors STE website tags) ────────────────────────

type TruckConfig = { label: string; tag: string };
type TruckMake = { label: string; icon: string; logo: string; logoImage?: string; LogoComponent?: React.ComponentType<{ className?: string }>; configs: TruckConfig[] };

const TRUCK_MAKES: TruckMake[] = [
  {
    label: "Ford",
    icon: "🔵",
    logo: "",
    logoImage: "/images/ford-logo.png",
    LogoComponent: FordLogo,
    configs: [
      { label: "Dually 2020+", tag: "FD20C" },
      { label: "Dually 2017–2019", tag: "FD1719" },
      { label: "Dually 2016 & Older", tag: "FD016" },
      { label: "SRW Long Bed 2020+", tag: "FSLB20C" },
      { label: "SRW Long Bed 2017–2019", tag: "FSLB1719" },
      { label: "SRW Long Bed 2016 & Older", tag: "FSLBO016" },
      { label: "SRW Short Bed", tag: "FSSB" },
    ],
  },
  {
    label: "Ram",
    icon: "🔴",
    logo: "",
    logoImage: "/images/ram-logo.png",
    LogoComponent: RamLogo,
    configs: [
      { label: "Dually 2003+", tag: "RD03C" },
      { label: "Dually 2002 & Older", tag: "RDO02" },
      { label: "SRW Long Bed 2003+", tag: "RSLB03C" },
      { label: "SRW Long Bed 2002 & Older", tag: "RSLBO02" },
      { label: "Mega Cab Dually", tag: "Rmega" },
      { label: "SRW Short Bed", tag: "RSSB" },
    ],
  },
  {
    label: "Chevy / GMC",
    icon: "🟡",
    logo: "",
    logoImage: "/images/gm-logo.png",
    LogoComponent: ChevyLogo,
    configs: [
      { label: "Dually", tag: "CD" },
      { label: "SRW Long Bed", tag: "CSLB" },
      { label: "SRW Short Bed", tag: "CSSB" },
    ],
  },
  {
    label: "Cab & Chassis",
    icon: "⚫",
    logo: "",
    configs: [
      { label: '84" DRW', tag: "CCB84" },
      { label: '60" DRW', tag: "CCB60" },
      { label: '60" SRW', tag: "CCBS60" },
    ],
  },
];

// ─── Category icons ──────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  "Front Bumpers": "🛡️",
  "Rear Bumpers": "🛡️",
  "Grille Guards": "⚔️",
  "Steps & Running Boards": "🪜",
  "Gooseneck Hitches": "🔗",
  "Tow & Stow Hitches": "🔗",
  "Toolboxes": "🧰",
  "Side Packs": "📦",
  "Saddle Boxes": "📦",
  "Transfer Tanks": "⛽",
  "Tank/Toolbox Combos": "⛽",
  "Transfer Pumps": "⛽",
  "Winches": "🏗️",
  "Air Bags": "🎈",
  "Jumper Cables": "⚡",
  "Floor Mats": "🏠",
  "Bed Liners": "🛏️",
  "Fire Extinguishers": "🧯",
  "Vises": "🔩",
  "Rat Packs": "🗃️",
  "CTech Cabinets": "🗄️",
  "Cabinet Lighting": "💡",
  "Work Lights": "💡",
  "Ladder Racks": "🔧",
};

// Categories where quantity is limited to 1 (one per truck)
const SINGLE_QTY_CATEGORIES = new Set([
  "Front Bumpers",
  "Rear Bumpers",
  "Grille Guards",
  "Gooseneck Hitches",
  "Bed Liners",
]);

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
  return `$${price.toLocaleString()}`;
}

// ─── Step 1: Truck Selector ──────────────────────────────────────────────────

function TruckSelector({
  onSelect,
  onSkip,
}: {
  onSelect: (make: TruckMake, config: TruckConfig) => void;
  onSkip: () => void;
}) {
  const [selectedMake, setSelectedMake] = useState<TruckMake | null>(null);

  if (!selectedMake) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <Truck className="size-12 mx-auto mb-3 text-primary" />
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

        <button
          type="button"
          onClick={onSkip}
          className="w-full mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2 py-3"
        >
          <SkipForward className="size-4" />
          Skip — accessories only (no bed)
        </button>
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
        {selectedMake.configs.map((config) => (
          <button
            key={config.tag}
            type="button"
            onClick={() => onSelect(selectedMake, config)}
            className="w-full flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all active:scale-[0.98]"
          >
            <span className="text-sm font-semibold flex-1 text-left">
              {config.label}
            </span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="w-full mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2 py-3"
      >
        <SkipForward className="size-4" />
        Skip — accessories only (no bed)
      </button>
    </div>
  );
}

// ─── Step 2: Bed Picker ──────────────────────────────────────────────────────

// ─── Bed Category icons & display order ──────────────────────────────────────

const BED_CATEGORY_META: Record<string, { icon: string; image?: string; order: number }> = {
  "Non-Skirted":     { icon: "🛻", image: "/images/non-skirted.png", order: 1 },
  "Skirted":         { icon: "🚛", image: "/images/skirted.png", order: 2 },
  "Skirted Deluxe":  { icon: "✨", image: "/images/skirted-deluxe.png", order: 3 },
  "Platform":        { icon: "📐", image: "/images/platform.png", order: 4 },
  "Hauler":          { icon: "🏋️", image: "/images/hauler.png", order: 5 },
  "Utility":         { icon: "🔧", image: "/images/utility.png", order: 6 },
  "Service Body":    { icon: "🧰", image: "/images/service-body.png", order: 7 },
  "Crane Body":      { icon: "🏗️", image: "/images/crane-body.png", order: 8 },
  "Dump":            { icon: "⏬", order: 9 },
  "SpaceKap":        { icon: "🏠", order: 10 },
};

// ─── Step 2: Bed Picker (Category → Brand → Beds) ───────────────────────────

function BedPicker({
  make,
  config,
  onSelectBed,
  onSkip,
  onBack,
}: {
  make: TruckMake;
  config: TruckConfig;
  onSelectBed: (bed: InventoryItem) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const allInventory = useQuery(api.inventory.list);

  type BedSubStep = "category" | "brand" | "beds";
  const [subStep, setSubStep] = useState<BedSubStep>("category");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [bedSearch, setBedSearch] = useState("");
  const [haySpike, setHaySpike] = useState(false);

  // All beds that match this truck config
  const matchingBeds = useMemo(() => {
    if (!allInventory) return [];
    return allInventory.filter(
      (inv) =>
        inv.fitmentTags &&
        inv.fitmentTags.includes(config.tag)
    );
  }, [allInventory, config.tag]);

  // Categories available for this truck (with counts)
  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of matchingBeds) {
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
  }, [matchingBeds]);

  // Brands available within the selected category (with counts)
  const brands = useMemo(() => {
    if (!selectedCategory) return [];
    const counts: Record<string, number> = {};
    for (const b of matchingBeds) {
      if ((b.bedCategory || "Other") !== selectedCategory) continue;
      const brand = b.brand || "Other";
      counts[brand] = (counts[brand] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [matchingBeds, selectedCategory]);

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
  }, [matchingBeds, selectedCategory, selectedBrand, haySpike, bedSearch]);

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
      // Count brands in this category
      const catBeds = matchingBeds.filter((b) => (b.bedCategory || "Other") === cat);
      const uniqueBrands = new Set(catBeds.map((b) => b.brand || "Other"));
      if (uniqueBrands.size <= 1) {
        // Only one brand — skip brand step, go straight to beds
        setSelectedBrand(uniqueBrands.values().next().value ?? null);
        setSubStep("beds");
      } else {
        setSubStep("brand");
      }
    },
    [matchingBeds]
  );

  // ── Select brand
  const handleSelectBrand = useCallback((brand: string) => {
    setSelectedBrand(brand);
    setSubStep("beds");
  }, []);

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
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="size-4" />
        {subStep === "category" ? "Change truck" : subStep === "brand" ? "Change category" : "Change brand"}
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
                    <Badge variant="secondary" className="text-xs">{cat.count}</Badge>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                );
              })}

              {/* Hay spike toggle */}
              <div className="flex items-center gap-3 p-4 rounded-xl border bg-card">
                <span className="text-2xl">🌾</span>
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
            </div>
          )}

          {/* ── Sub-step: Brand selector ── */}
          {subStep === "brand" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground mb-1">Select a brand</p>
              {/* All brands button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedBrand(null);
                  setSubStep("beds");
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all active:scale-[0.99]"
              >
                <span className="text-2xl">📋</span>
                <span className="flex-1 text-left font-medium">All Brands</span>
                <Badge variant="secondary" className="text-xs">
                  {brands.reduce((s, b) => s + b.count, 0)}
                </Badge>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
              {brands.map((brand) => (
                <button
                  key={brand.name}
                  type="button"
                  onClick={() => handleSelectBrand(brand.name)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all active:scale-[0.99]"
                >
                  <span className="flex-1 text-left font-medium">{brand.name}</span>
                  <Badge variant="secondary" className="text-xs">{brand.count}</Badge>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
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
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="size-10 mx-auto mb-2 opacity-30" />
                  <p>
                    {bedSearch ? "No beds match your search" : "No beds currently in stock"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredBeds.map((bed) => (
                    <button
                      key={bed._id}
                      type="button"
                      onClick={() => onSelectBed(bed as InventoryItem)}
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
        className="w-full mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2 py-3"
      >
        <SkipForward className="size-4" />
        Skip bed — accessories only
      </button>
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
          <span className="mr-1">{CATEGORY_ICONS[cat.name] || "📦"}</span>
          {cat.name}
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
}: {
  item: Accessory;
  laborRate: number;
  defaultMarkup: number;
  onAddToQuote: (item: Accessory) => void;
  showCost: boolean;
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

  return (
    <Card
      className={`group transition-all hover:shadow-md ${isPending ? "opacity-60 border-dashed" : ""}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {item.imageUrl && !imgError ? (
            <div className="shrink-0 size-20 rounded-lg overflow-hidden bg-muted border">
              <img
                src={item.imageUrl}
                alt={`${item.brand} ${item.series}`}
                className="size-full object-contain p-1"
                onError={() => setImgError(true)}
                loading="lazy"
              />
            </div>
          ) : (
            <div className="shrink-0 size-20 rounded-lg bg-muted border flex items-center justify-center">
              <Package className="size-8 text-muted-foreground/30" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {item.partNumber}
              </span>
              <Badge variant="outline" className="text-xs shrink-0">
                {item.brand}
              </Badge>
            </div>
            <h3 className="font-semibold text-sm leading-tight mb-1">
              {item.series}
            </h3>
            {item.notes && (
              <p className="text-xs text-muted-foreground">{item.notes}</p>
            )}
          </div>

          <div className="text-right shrink-0">
            {!isPending ? (
              <>
                <div className="text-xl font-bold tracking-tight text-primary">
                  {formatPrice(sellPrice)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {isAutoPrice ? `${effectiveMarkup}% markup` : "parts only"}
                </div>
              </>
            ) : (
              <div className="text-sm font-medium text-muted-foreground">
                Pricing TBD
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground">
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
          {!isPending && installCost > 0 && (
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <DollarSign className="size-3" />
              Total: {formatPrice(totalPrice)}
            </span>
          )}
          {showCost && item.cost > 0 && (
            <span className="flex items-center gap-1 ml-auto text-amber-600 dark:text-amber-400">
              <Tag className="size-3" />
              Cost: {formatPrice(item.cost)} ({margin.toFixed(0)}% margin)
            </span>
          )}
        </div>

        {!isPending && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 text-xs"
            onClick={() => onAddToQuote(item)}
          >
            <Plus className="size-3.5 mr-1" />
            Add to Quote
          </Button>
        )}
      </CardContent>
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
  onShare,
  onClearBed,
  shareLoading,
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
  onShare: () => void;
  onClearBed: () => void;
  shareLoading: boolean;
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

  // Tax & salesperson state
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(6.75);
  const [selectedSalesperson, setSelectedSalesperson] = useState<Salesperson | null>(null);

  const subtotal = partsTotal + installTotal + bedPrice + bedInstallCost;
  const taxAmount = taxEnabled ? Math.round(subtotal * (taxRate / 100) * 100) / 100 : 0;
  const grandTotal = subtotal + taxAmount;

  return (
    <div className="flex flex-col h-full overflow-auto">
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
              {bedPrice > 0 && (
                <p className="text-sm font-bold text-green-700 mt-0.5">
                  {formatPrice(bedPrice)}
                </p>
              )}
              <a
                href={linkedBed.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline mt-1"
              >
                <ExternalLink className="size-3" />
                View on website
              </a>
            </div>
            <button
              type="button"
              onClick={onClearBed}
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              <X className="size-4" />
            </button>
          </div>
          {/* Bed Installation toggle */}
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
              />
            );
          })}
        </div>
      )}

      {/* Totals & Share */}
      {(items.length > 0 || linkedBed) && (
        <div className="mt-auto pt-4 border-t space-y-2">
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
                Accessory Install ({totalInstallHours}hrs @ {formatPrice(laborRate)}
                /hr)
              </span>
              <span>{formatPrice(installTotal)}</span>
            </div>
          )}
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

          {/* Salesperson selector */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground shrink-0">Salesperson:</span>
            <select
              value={selectedSalesperson?.name ?? ""}
              onChange={(e) => {
                const sp = SALESPEOPLE.find((s) => s.name === e.target.value) ?? null;
                setSelectedSalesperson(sp);
              }}
              className="flex-1 text-xs border rounded px-2 py-1.5 bg-white"
            >
              <option value="">Select...</option>
              {SALESPEOPLE.map((sp) => (
                <option key={sp.name} value={sp.name}>{sp.name}</option>
              ))}
            </select>
          </div>

          <p className="text-[10px] text-center text-muted-foreground">
            Labor rate: ${laborRate}/hr • Default markup: {defaultMarkup}%
          </p>
          <div className="flex gap-2 mt-2">
            <Button
              className="flex-1"
              onClick={onShare}
              disabled={shareLoading}
            >
              <Share2 className="size-4 mr-2" />
              {shareLoading ? "Creating…" : "Share Quote"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                const pdfItems: QuotePdfItem[] = [];
                // Bed line item — always include if bed is linked
                if (linkedBed) {
                  pdfItems.push({
                    activity: "Truck Bed Sales",
                    description: linkedBed.title || "Truck Bed",
                    qty: 1,
                    rate: bedPrice,
                    amount: bedPrice,
                  });
                }
                // Bed installation
                if (linkedBed && bedInstallEnabled && bedInstallCost > 0) {
                  pdfItems.push({
                    activity: "Installation",
                    description: "Pick Up/Delivery & Installation",
                    qty: 1,
                    rate: bedInstallCost,
                    amount: bedInstallCost,
                  });
                }
                // Accessory items
                for (const qi of items) {
                  const p = quoteItemPrice(qi);
                  pdfItems.push({
                    activity: "Parts - Retail",
                    description: `${qi.accessory.brand} ${qi.accessory.series}${qi.accessory.partNumber ? ` (${qi.accessory.partNumber})` : ""}`,
                    qty: qi.quantity,
                    rate: p,
                    amount: p * qi.quantity,
                  });
                }
                // Accessory installation
                if (installTotal > 0) {
                  pdfItems.push({
                    activity: "Installation",
                    description: `Accessory Install (${totalInstallHours}hrs @ $${laborRate}/hr)`,
                    qty: 1,
                    rate: installTotal,
                    amount: installTotal,
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
                });
                // Open in new tab instead of downloading (avoids false virus warnings)
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
}: {
  qi: QuoteItem;
  price: number;
  install: number;
  defaultMarkup: number;
  onUpdateQty: (id: string, qty: number) => void;
  onUpdatePrice: (id: string, price: number | undefined) => void;
  onUpdateMarkup: (id: string, markup: number | undefined) => void;
  onRemove: (id: string) => void;
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
            {qi.accessory.partNumber} • {qi.accessory.category}
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

        {/* Price (tap to edit) */}
        <div className="text-right">
          {editingPrice ? (
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
          ) : (
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
  showCost,
}: {
  truckMake: TruckMake | null;
  truckConfig: TruckConfig | null;
  linkedBed: InventoryItem | null;
  onAddToQuote: (item: Accessory) => void;
  onChangeTruck: () => void;
  showCost: boolean;
}) {
  const accessories = useQuery(api.accessories.listAll);
  const settingsMarkup = useQuery(api.accessories.getDefaultMarkup);
  const settingsRate = useQuery(api.accessories.getLaborRate);
  const markup = settingsMarkup ?? 40;
  const rate = settingsRate ?? 150;

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Hide Rear Bumpers when a bed is selected (bed replaces the bumper)
  const HIDDEN_CATEGORIES_WITH_BED = new Set(["Rear Bumpers"]);

  // Selected truck make label for fitment filtering
  const selectedMakeLabel = truckMake?.label ?? null;

  const filteredItems = useMemo(() => {
    if (!accessories) return [];
    let items = [...accessories];
    // Hide categories that don't apply when a bed is selected
    if (linkedBed) {
      items = items.filter((i) => !HIDDEN_CATEGORIES_WITH_BED.has(i.category));
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
  }, [accessories, selectedCategory, searchQuery, linkedBed, selectedMakeLabel]);

  const categories = useMemo(() => {
    if (!accessories) return [];
    let items = [...accessories];
    if (linkedBed) {
      items = items.filter((i) => !HIDDEN_CATEGORIES_WITH_BED.has(i.category));
    }
    // Also filter by truck make for category counts
    if (selectedMakeLabel) {
      items = items.filter(
        (i) => !i.fitmentMakes || i.fitmentMakes.length === 0 || i.fitmentMakes.includes(selectedMakeLabel)
      );
    }
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.category, (map.get(item.category) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accessories, linkedBed]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filteredItems>();
    for (const item of filteredItems) {
      const group = map.get(item.category) || [];
      group.push(item);
      map.set(item.category, group);
    }
    return map;
  }, [filteredItems]);

  return (
    <>
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
          {linkedBed && (
            <>
              <ChevronRight className="size-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate shrink-0 max-w-[200px]">
                {linkedBed.title}
              </span>
            </>
          )}
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
            onSelect={setSelectedCategory}
          />
        </div>
      </div>

      {/* Accessory grid */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="size-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No items found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Array.from(grouped.entries()).map(([category, items]) => (
              <section key={category}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">
                    {CATEGORY_ICONS[category] || "📦"}
                  </span>
                  <h2 className="text-lg font-bold">{category}</h2>
                  <Badge variant="secondary" className="text-xs">
                    {items.length}
                  </Badge>
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
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-12 pt-6 border-t text-center text-xs text-muted-foreground space-y-1">
          <p>
            {filteredItems.length} accessories across {grouped.size} categories •
            Labor rate: ${rate}/hr • Default markup: {markup}%
          </p>
          <p>
            Prices are rounded for easy reference. Exact quotes may vary by
            vehicle and configuration.
          </p>
          <p className="text-[10px] opacity-50">
            Star Truck Equipment — Wharton, TX • (979) 532-1486
          </p>
        </div>
      </main>
    </>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export function SalesToolPage() {
  // ── App state ──
  type AppStep = "truck" | "bed" | "accessories";
  const [step, setStep] = useState<AppStep>("truck");
  const [truckMake, setTruckMake] = useState<TruckMake | null>(null);
  const [truckConfig, setTruckConfig] = useState<TruckConfig | null>(null);
  const [linkedBed, setLinkedBed] = useState<InventoryItem | null>(null);

  // ── Quote state ──
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [showCost, setShowCost] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [bedInstallEnabled, setBedInstallEnabled] = useState(true);
  const [bedInstallPrice, setBedInstallPrice] = useState(1500);
  const [pumpPromptOpen, setPumpPromptOpen] = useState(false);

  // ── Convex ──
  const allAccessories = useQuery(api.accessories.listAll);
  const settingsMarkup = useQuery(api.accessories.getDefaultMarkup);
  const settingsRate = useQuery(api.accessories.getLaborRate);
  const markup = settingsMarkup ?? 40;
  const rate = settingsRate ?? 150;
  const createQuote = useMutation(api.quotes.createQuote);

  // ── Handlers ──
  const handleSelectTruck = useCallback(
    (make: TruckMake, config: TruckConfig) => {
      setTruckMake(make);
      setTruckConfig(config);
      setStep("bed");
    },
    []
  );

  const handleSkipTruck = useCallback(() => {
    setTruckMake(null);
    setTruckConfig(null);
    setLinkedBed(null);
    setStep("accessories");
  }, []);

  const handleSelectBed = useCallback((bed: InventoryItem) => {
    setLinkedBed(bed);
    setStep("accessories");
  }, []);

  const handleSkipBed = useCallback(() => {
    setLinkedBed(null);
    setStep("accessories");
  }, []);

  const handleChangeTruck = useCallback(() => {
    setStep("truck");
  }, []);

  // Categories that trigger the "add a transfer pump?" prompt
  const FUEL_CATEGORIES = new Set(["Transfer Tanks", "Tank/Toolbox Combos"]);

  const addToQuote = useCallback((item: Accessory) => {
    setQuoteItems((prev) => {
      const existing = prev.find((qi) => qi.accessory._id === item._id);
      if (existing) {
        return prev.map((qi) =>
          qi.accessory._id === item._id
            ? { ...qi, quantity: qi.quantity + 1 }
            : qi
        );
      }
      return [...prev, { accessory: item, quantity: 1 }];
    });
    toast.success("Added to quote");
    // Prompt for transfer pump when adding a fuel tank or combo
    if (FUEL_CATEGORIES.has(item.category)) {
      setPumpPromptOpen(true);
    }
  }, []);

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

  const handleShare = useCallback(async () => {
    if (quoteItems.length === 0 && !linkedBed) {
      toast.error("Add items or select a bed first");
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
      });

      const quoteUrl = `${window.location.origin}/quote/${slug}`;
      const estNum = slug.toUpperCase();

      // Build the PDF for sharing
      const pdfItems: QuotePdfItem[] = [];
      const bp = linkedBed ? ((linkedBed.salePrice ?? linkedBed.price) ?? 0) : 0;
      if (linkedBed) {
        pdfItems.push({ activity: "Truck Bed Sales", description: linkedBed.title || "Truck Bed", qty: 1, rate: bp, amount: bp });
      }
      for (const qi of quoteItems) {
        const p = getQuoteItemPrice(qi);
        pdfItems.push({
          activity: "Parts - Retail",
          description: `${qi.accessory.brand} ${qi.accessory.series}${qi.accessory.partNumber ? ` (${qi.accessory.partNumber})` : ""}`,
          qty: qi.quantity, rate: p, amount: p * qi.quantity,
        });
      }
      const partsSubtotal = quoteItems.reduce((s, qi) => s + getQuoteItemPrice(qi) * qi.quantity, 0);
      const instHrs = quoteItems.reduce((s, qi) => s + (qi.accessory.installHours ?? 0) * qi.quantity, 0);
      const instTotal = instHrs * rate;
      if (instTotal > 0) {
        pdfItems.push({ activity: "Installation", description: `Accessory Install (${instHrs}hrs @ $${rate}/hr)`, qty: 1, rate: instTotal, amount: instTotal });
      }
      const gt = bp + partsSubtotal + instTotal;
      const today = new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
      const pdf = generateQuotePdf({ estimateNumber: estNum, date: today, items: pdfItems, subtotal: gt,
        taxRate: 0.0675, taxEnabled: false, total: gt,
        truckLabel: truckMake && truckConfig ? `${truckMake.label} — ${truckConfig.label}` : undefined,
      });
      const pdfBlob = pdf.output("blob");
      const pdfFile = new File([pdfBlob], `Star-Estimate-${estNum}.pdf`, { type: "application/pdf" });

      // Try native share with PDF attachment, fallback to mailto + clipboard
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            title: `Star Truck Equipment — Estimate ${estNum}`,
            text: `Here's your estimate from Star Truck Equipment.\n\nView online: ${quoteUrl}`,
            files: [pdfFile],
          });
          return;
        } catch { /* user cancelled — fall through */ }
      }

      // Fallback: open mailto with quote link + copy URL
      const subject = encodeURIComponent(`Star Truck Equipment — Estimate ${estNum}`);
      const body = encodeURIComponent(`Here's your estimate from Star Truck Equipment.\n\nView online: ${quoteUrl}\n\nTotal: $${gt.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
      window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
      try { await navigator.clipboard.writeText(quoteUrl); } catch {}
      toast.success("Quote link copied — paste into your email!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create quote");
    } finally {
      setShareLoading(false);
    }
  }, [
    quoteItems,
    rate,
    createQuote,
    getQuoteItemPrice,
    linkedBed,
    truckMake,
    truckConfig,
  ]);

  const quoteCount = quoteItems.reduce((s, qi) => s + qi.quantity, 0) + (linkedBed ? 1 : 0);

  // ── Render ──
  return (
    <div className="min-h-screen bg-background">
      {/* Header — always visible */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
                <Wrench className="size-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-bold leading-none">Star Truck</h1>
                <span className="text-[10px] text-muted-foreground leading-none">
                  Sales Tool
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Cost toggle (internal) */}
            <button
              type="button"
              onClick={() => setShowCost(!showCost)}
              className={`p-2 rounded-md transition-colors ${showCost ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" : "text-muted-foreground hover:text-foreground"}`}
              title="Toggle cost view"
            >
              <Tag className="size-4" />
            </button>

            {/* Quote badge */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="relative gap-1.5">
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
                    onShare={handleShare}
                    onClearBed={() => setLinkedBed(null)}
                    shareLoading={shareLoading}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Step content */}
      {step === "truck" && (
        <TruckSelector
          onSelect={handleSelectTruck}
          onSkip={handleSkipTruck}
        />
      )}

      {step === "bed" && truckMake && truckConfig && (
        <BedPicker
          make={truckMake}
          config={truckConfig}
          onSelectBed={handleSelectBed}
          onSkip={handleSkipBed}
          onBack={handleChangeTruck}
        />
      )}

      {step === "accessories" && (
        <AccessoriesCatalog
          truckMake={truckMake}
          truckConfig={truckConfig}
          linkedBed={linkedBed}
          onAddToQuote={addToQuote}
          onChangeTruck={handleChangeTruck}
          showCost={showCost}
        />
      )}

      {/* Transfer Pump prompt — appears when a fuel tank/combo is added */}
      {pumpPromptOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
             onClick={() => setPumpPromptOpen(false)}>
          <div className="bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4"
               onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">⛽ Add a Transfer Pump?</h3>
            <p className="text-sm text-muted-foreground">
              Fuel tanks don't include a pump. Would you like to add one?
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(allAccessories ?? [])
                .filter((a) => a.category === "Transfer Pumps")
                .map((pump) => {
                  const sell = pump.sellPrice ?? Math.round(pump.cost * (1 + markup / 100));
                  return (
                    <button
                      key={pump._id}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-all text-left"
                      onClick={() => {
                        addToQuote(pump);
                        setPumpPromptOpen(false);
                      }}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{pump.brand} {pump.series}</p>
                        <p className="text-xs text-muted-foreground">{pump.notes}</p>
                      </div>
                      <span className="font-bold text-sm">${sell.toLocaleString()}</span>
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
      )}
    </div>
  );
}
