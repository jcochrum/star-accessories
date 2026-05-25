import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  Filter,
  Lock,
  Package,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

/* ──────────────────── TYPES ──────────────────── */
type Accessory = {
  _id: Id<"accessories">;
  _creationTime: number;
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
  source: string;
  notes?: string;
  imageUrl?: string;
  fitmentMakes?: string[];
  sortOrder: number;
};

/* ──────────────────── PASSWORD GATE ──────────────────── */
function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const checkPassword = useQuery(api.admin.checkPassword, { password: password || "___noop___" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    // checkPassword is reactive — we just need to verify
    if (checkPassword === true) {
      onAuth();
    } else {
      setError(true);
      setChecking(false);
    }
  };

  useEffect(() => {
    if (checking && checkPassword === true) {
      onAuth();
    } else if (checking && checkPassword === false) {
      setError(true);
      setChecking(false);
    }
  }, [checkPassword, checking, onAuth]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 w-full max-w-sm">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-slate-900 mx-auto mb-6">
          <Lock className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-xl font-bold text-center text-slate-900 mb-2">Admin Panel</h1>
        <p className="text-sm text-slate-500 text-center mb-6">
          Enter the admin password to manage accessories.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            placeholder="Password"
            className={`w-full px-4 py-3 rounded-xl border-2 text-base transition-colors outline-none ${
              error ? "border-red-400 bg-red-50" : "border-slate-200 focus:border-slate-400"
            }`}
            autoFocus
          />
          {error && <p className="text-red-500 text-sm mt-2">Incorrect password</p>}
          <button
            type="submit"
            className="w-full mt-4 bg-slate-900 text-white font-semibold py-3 rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}

/* ──────────────────── EDIT ROW ──────────────────── */
function EditableRow({
  item,
  defaultMarkup,
  onSave,
  onDelete,
}: {
  item: Accessory;
  defaultMarkup: number;
  onSave: (id: Id<"accessories">, fields: Record<string, unknown>) => void;
  onDelete: (id: Id<"accessories">, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [cost, setCost] = useState(String(item.cost));
  const [sell, setSell] = useState(item.sellPrice != null ? String(item.sellPrice) : "");
  const [hours, setHours] = useState(item.installHours != null ? String(item.installHours) : "");
  const [markup, setMarkup] = useState(
    item.markupPercent != null ? String(item.markupPercent) : ""
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const effectiveMarkup = item.markupPercent ?? defaultMarkup;
  const effectiveSell =
    item.sellPrice != null
      ? item.sellPrice
      : Math.round(item.cost * (1 + effectiveMarkup / 100) * 100) / 100;

  const handleSave = () => {
    const updates: Record<string, unknown> = {};
    const newCost = Number.parseFloat(cost);
    if (!Number.isNaN(newCost) && newCost !== item.cost) updates.cost = newCost;

    const newSell = sell.trim() === "" ? undefined : Number.parseFloat(sell);
    if (newSell !== undefined && !Number.isNaN(newSell) && newSell !== item.sellPrice) {
      updates.sellPrice = newSell;
    } else if (sell.trim() === "" && item.sellPrice != null) {
      // Clear sell override — go back to markup calc
      updates.sellPrice = 0; // Will need to handle 0 as "clear"
    }

    const newHours = hours.trim() === "" ? undefined : Number.parseFloat(hours);
    if (newHours !== undefined && !Number.isNaN(newHours) && newHours !== item.installHours) {
      updates.installHours = newHours;
    }

    const newMarkup = markup.trim() === "" ? undefined : Number.parseFloat(markup);
    if (newMarkup !== undefined && !Number.isNaN(newMarkup) && newMarkup !== item.markupPercent) {
      updates.markupPercent = newMarkup;
    }

    if (Object.keys(updates).length > 0) {
      onSave(item._id, updates);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setCost(String(item.cost));
    setSell(item.sellPrice != null ? String(item.sellPrice) : "");
    setHours(item.installHours != null ? String(item.installHours) : "");
    setMarkup(item.markupPercent != null ? String(item.markupPercent) : "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm text-slate-900">{item.series}</div>
            <div className="text-xs text-slate-500">
              {item.brand} · {item.partNumber}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1 bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700 transition"
            >
              <Check className="w-3.5 h-3.5" /> Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-300 transition"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Cost
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                $
              </span>
              <input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                step="0.01"
                className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-blue-400 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Sell Price{" "}
              <span className="normal-case text-slate-400">(blank = use markup)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                $
              </span>
              <input
                type="number"
                value={sell}
                onChange={(e) => setSell(e.target.value)}
                step="0.01"
                placeholder={String(Math.round(Number(cost || 0) * 1.4))}
                className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-blue-400 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Markup %{" "}
              <span className="normal-case text-slate-400">(default {defaultMarkup}%)</span>
            </label>
            <input
              type="number"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
              step="1"
              placeholder={String(defaultMarkup)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-blue-400 outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Install Hours
            </label>
            <input
              type="number"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              step="0.25"
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-blue-400 outline-none"
            />
          </div>
        </div>
        {/* Delete button */}
        <div className="pt-2 border-t border-blue-200">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-medium">Delete this item?</span>
              <button
                onClick={() => onDelete(item._id, item.series)}
                className="bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-700 transition"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-300 transition"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove item
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full text-left bg-white border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-slate-900 truncate">{item.series}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {item.brand} · {item.partNumber}
          </div>
        </div>
        <div className="flex items-center gap-3 ml-3 shrink-0">
          <div className="text-right">
            <div className="font-bold text-sm text-slate-900">
              ${effectiveSell.toLocaleString("en-US", { minimumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-slate-400">
              cost ${item.cost.toLocaleString("en-US", { minimumFractionDigits: 0 })}
              {item.installHours ? ` · ${item.installHours}hr` : ""}
            </div>
          </div>
          <Edit3 className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" />
        </div>
      </div>
    </button>
  );
}

/* ──────────────────── ADD ITEM FORM ──────────────────── */
function AddItemForm({
  category,
  onAdd,
  onCancel,
  existingCount,
}: {
  category: string;
  onAdd: (fields: Record<string, unknown>) => void;
  onCancel: () => void;
  existingCount: number;
}) {
  const [brand, setBrand] = useState("");
  const [series, setSeries] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [cost, setCost] = useState("");
  const [sell, setSell] = useState("");
  const [hours, setHours] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim() || !series.trim()) {
      toast.error("Brand and name are required");
      return;
    }
    onAdd({
      category,
      brand: brand.trim(),
      series: series.trim(),
      partNumber: partNumber.trim() || `CUSTOM-${Date.now()}`,
      cost: Number.parseFloat(cost) || 0,
      sellPrice: sell.trim() ? Number.parseFloat(sell) : undefined,
      installHours: hours.trim() ? Number.parseFloat(hours) : undefined,
      source: "Admin",
      sortOrder: existingCount + 1,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-green-50 border-2 border-green-200 rounded-xl p-4 space-y-3">
      <div className="font-semibold text-sm text-green-800">Add New Item to {category}</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
            Brand *
          </label>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Ranch Hand"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-green-400 outline-none"
            autoFocus
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
            Name / Series *
          </label>
          <input
            value={series}
            onChange={(e) => setSeries(e.target.value)}
            placeholder="e.g. Legend Front Bumper"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-green-400 outline-none"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
            Part Number
          </label>
          <input
            value={partNumber}
            onChange={(e) => setPartNumber(e.target.value)}
            placeholder="Optional"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-green-400 outline-none"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
            Cost
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              step="0.01"
              placeholder="0"
              className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-green-400 outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
            Sell Price <span className="normal-case text-slate-400">(blank = use markup)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number"
              value={sell}
              onChange={(e) => setSell(e.target.value)}
              step="0.01"
              className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-green-400 outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
            Install Hours
          </label>
          <input
            type="number"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            step="0.25"
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-green-400 outline-none"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-green-700 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add Item
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 bg-slate-200 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-slate-300 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ──────────────────── CATEGORY SECTION ──────────────────── */
function CategorySection({
  name,
  items,
  defaultMarkup,
  onSave,
  onDelete,
  onAdd,
  isExpanded,
  onToggle,
}: {
  name: string;
  items: Accessory[];
  defaultMarkup: number;
  onSave: (id: Id<"accessories">, fields: Record<string, unknown>) => void;
  onDelete: (id: Id<"accessories">, name: string) => void;
  onAdd: (fields: Record<string, unknown>) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder),
    [items]
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
          <div className="text-left">
            <div className="font-semibold text-slate-900">{name}</div>
            <div className="text-xs text-slate-500">{items.length} items</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-full">
            {items.length}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 p-4 space-y-2">
          {sorted.map((item) => (
            <EditableRow
              key={item._id}
              item={item}
              defaultMarkup={defaultMarkup}
              onSave={onSave}
              onDelete={onDelete}
            />
          ))}

          {showAddForm ? (
            <AddItemForm
              category={name}
              onAdd={(fields) => {
                onAdd(fields);
                setShowAddForm(false);
              }}
              onCancel={() => setShowAddForm(false)}
              existingCount={items.length}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 transition"
            >
              <Plus className="w-4 h-4" /> Add Item
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────── SETTINGS PANEL ──────────────────── */
function SettingsPanel({
  defaultMarkup,
  laborRate,
}: {
  defaultMarkup: number;
  laborRate: number;
}) {
  const updateSetting = useMutation(api.admin.updateSetting);
  const [localMarkup, setLocalMarkup] = useState(String(defaultMarkup));
  const [localRate, setLocalRate] = useState(String(laborRate));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalMarkup(String(defaultMarkup));
    setLocalRate(String(laborRate));
  }, [defaultMarkup, laborRate]);

  const handleSave = async () => {
    await updateSetting({ key: "defaultMarkupPercent", value: localMarkup });
    await updateSetting({ key: "laborRate", value: localRate });
    setSaved(true);
    toast.success("Settings saved");
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-slate-600" />
        <h3 className="font-semibold text-slate-900">Global Settings</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Default Markup %
          </label>
          <input
            type="number"
            value={localMarkup}
            onChange={(e) => setLocalMarkup(e.target.value)}
            step="1"
            className="w-full px-3 py-2.5 mt-1 rounded-lg border border-slate-200 text-sm focus:border-slate-400 outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Labor Rate ($/hr)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number"
              value={localRate}
              onChange={(e) => setLocalRate(e.target.value)}
              step="5"
              className="w-full pl-7 pr-3 py-2.5 mt-1 rounded-lg border border-slate-200 text-sm focus:border-slate-400 outline-none"
            />
          </div>
        </div>
      </div>
      <button
        onClick={handleSave}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
          saved
            ? "bg-green-100 text-green-700"
            : "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]"
        }`}
      >
        {saved ? (
          <>
            <Check className="w-4 h-4" /> Saved
          </>
        ) : (
          "Save Settings"
        )}
      </button>
    </div>
  );
}

/* ──────────────────── MAIN ADMIN PAGE ──────────────────── */
export function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);

  const allItems = useQuery(api.admin.listAllForAdmin);
  const defaultMarkup = useQuery(api.accessories.getDefaultMarkup);
  const laborRate = useQuery(api.accessories.getLaborRate);

  const updateAccessory = useMutation(api.admin.updateAccessory);
  const deleteAccessory = useMutation(api.admin.deleteAccessory);
  const addAccessory = useMutation(api.admin.addAccessory);

  const handleAuth = useCallback(() => setAuthed(true), []);

  // Group by category
  const { categories, filteredGrouped, totalCount } = useMemo(() => {
    if (!allItems) return { categories: [], filteredGrouped: new Map(), totalCount: 0 };

    const grouped = new Map<string, Accessory[]>();
    for (const item of allItems) {
      const list = grouped.get(item.category) || [];
      list.push(item);
      grouped.set(item.category, list);
    }

    const catList = Array.from(grouped.keys()).sort();

    // Filter
    const fg = new Map<string, Accessory[]>();
    let total = 0;
    for (const [cat, items] of grouped) {
      if (selectedCategory && cat !== selectedCategory) continue;
      const filtered = search.trim()
        ? items.filter(
            (i) =>
              i.series.toLowerCase().includes(search.toLowerCase()) ||
              i.brand.toLowerCase().includes(search.toLowerCase()) ||
              i.partNumber.toLowerCase().includes(search.toLowerCase())
          )
        : items;
      if (filtered.length > 0) {
        fg.set(cat, filtered);
        total += filtered.length;
      }
    }

    return { categories: catList, filteredGrouped: fg, totalCount: total };
  }, [allItems, search, selectedCategory]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleSave = async (id: Id<"accessories">, fields: Record<string, unknown>) => {
    try {
      await updateAccessory({ id, ...fields } as Parameters<typeof updateAccessory>[0]);
      toast.success("Item updated");
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (id: Id<"accessories">, name: string) => {
    try {
      await deleteAccessory({ id });
      toast.success(`Deleted "${name}"`);
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleAdd = async (fields: Record<string, unknown>) => {
    try {
      await addAccessory(fields as Parameters<typeof addAccessory>[0]);
      toast.success("Item added");
    } catch {
      toast.error("Failed to add item");
    }
  };

  if (!authed) {
    return <PasswordGate onAuth={handleAuth} />;
  }

  if (!allItems || defaultMarkup === undefined || laborRate === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a
                href="/"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 transition"
              >
                <ArrowLeft className="w-4 h-4 text-slate-600" />
              </a>
              <div>
                <h1 className="font-bold text-lg text-slate-900">Admin Panel</h1>
                <p className="text-xs text-slate-500">
                  {totalCount} items · {categories.length} categories
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                showSettings
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Settings panel */}
        {showSettings && (
          <SettingsPanel
            defaultMarkup={defaultMarkup}
            laborRate={laborRate ?? 150}
          />
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-sm focus:border-slate-400 outline-none shadow-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              !selectedCategory
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                cat === selectedCategory
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Category sections */}
        {Array.from(filteredGrouped.entries()).map(([cat, items]) => (
          <CategorySection
            key={cat}
            name={cat}
            items={items}
            defaultMarkup={defaultMarkup}
            onSave={handleSave}
            onDelete={handleDelete}
            onAdd={handleAdd}
            isExpanded={expandedCategories.has(cat)}
            onToggle={() => toggleCategory(cat)}
          />
        ))}

        {filteredGrouped.size === 0 && (
          <div className="text-center py-12">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No items found</p>
          </div>
        )}

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
}
