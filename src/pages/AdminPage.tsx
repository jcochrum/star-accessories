import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  Filter,
  KeyRound,
  Layers,
  Lock,
  Mail,
  MessageSquare,
  Package,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  Trash2,
  User,
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
  fitment?: Array<{ make: string; models: string[]; cabTypes: string[] }>;
  fitmentCabTypes?: string[];
  sortOrder: number;
  priceUpdatedAt?: number;
  priceUpdatedBy?: string;
  isVisible?: boolean;
  images?: Array<{ url: string; isPrimary?: boolean; caption?: string; make?: string }>;
  productFamily?: string;
  compatibleCALengths?: string[];
};

/* ──────────────────── PASSWORD GATE ──────────────────── */
function PasswordGate({ onAuth }: { onAuth: (remember: boolean) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem("admin_remember") === "1";
  });
  const checkPassword = useQuery(api.admin.checkPassword, { password: password || "___noop___" });

  // Forgot password state
  type ResetStep = "login" | "email" | "code" | "done";
  const [resetStep, setResetStep] = useState<ResetStep>("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const sendResetEmail = useAction(api.admin.sendResetEmail);
  const verifyResetCode = useMutation(api.admin.verifyResetCode);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    if (checkPassword === true) {
      onAuth(rememberMe);
    } else {
      setError(true);
      setChecking(false);
    }
  };

  useEffect(() => {
    if (checking && checkPassword === true) {
      onAuth(rememberMe);
    } else if (checking && checkPassword === false) {
      setError(true);
      setChecking(false);
    }
  }, [checkPassword, checking, onAuth, rememberMe]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setResetError("");
    try {
      const result = await sendResetEmail({ email: resetEmail.trim() });
      if (result.success) {
        setResetStep("code");
      } else {
        setResetError(result.error || "Failed to send code.");
      }
    } catch {
      setResetError("Something went wrong. Please try again.");
    }
    setResetLoading(false);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode.trim() || !newPassword.trim()) return;
    if (newPassword.length < 6) {
      setResetError("Password must be at least 6 characters.");
      return;
    }
    setResetLoading(true);
    setResetError("");
    try {
      const result = await verifyResetCode({
        email: resetEmail.trim(),
        code: resetCode.trim(),
        newPassword: newPassword.trim(),
      });
      if (result.success) {
        setResetStep("done");
      } else {
        setResetError(result.error || "Invalid code.");
      }
    } catch {
      setResetError("Something went wrong. Please try again.");
    }
    setResetLoading(false);
  };

  // Success screen after password reset
  if (resetStep === "done") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 w-full max-w-sm text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mx-auto mb-6">
            <Check className="w-7 h-7 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Password Updated</h1>
          <p className="text-sm text-slate-500 mb-6">Your admin password has been changed.</p>
          <button
            onClick={() => {
              setResetStep("login");
              setPassword("");
              setResetEmail("");
              setResetCode("");
              setNewPassword("");
              setResetError("");
            }}
            className="w-full bg-slate-900 text-white font-semibold py-3 rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // Enter email screen
  if (resetStep === "email") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 w-full max-w-sm">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 mx-auto mb-6">
            <Mail className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-center text-slate-900 mb-2">Forgot Password</h1>
          <p className="text-sm text-slate-500 text-center mb-6">
            Enter your email and we'll send you a 6-digit reset code.
          </p>
          <form onSubmit={handleSendCode}>
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => { setResetEmail(e.target.value); setResetError(""); }}
              placeholder="your@email.com"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-base transition-colors outline-none focus:border-slate-400"
              autoFocus
            />
            {resetError && <p className="text-red-500 text-sm mt-2">{resetError}</p>}
            <button
              type="submit"
              disabled={resetLoading}
              className="w-full mt-4 bg-slate-900 text-white font-semibold py-3 rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {resetLoading ? "Sending…" : "Send Reset Code"}
            </button>
          </form>
          <button
            onClick={() => { setResetStep("login"); setResetError(""); }}
            className="w-full mt-3 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            ← Back to login
          </button>
        </div>
      </div>
    );
  }

  // Enter code + new password screen
  if (resetStep === "code") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 w-full max-w-sm">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 mx-auto mb-6">
            <KeyRound className="w-7 h-7 text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-center text-slate-900 mb-2">Enter Reset Code</h1>
          <p className="text-sm text-slate-500 text-center mb-6">
            Check your email for a 6-digit code sent to <span className="font-medium text-slate-700">{resetEmail}</span>
          </p>
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <div>
              <input
                type="text"
                value={resetCode}
                onChange={(e) => { setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setResetError(""); }}
                placeholder="6-digit code"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-base text-center tracking-[0.3em] font-mono transition-colors outline-none focus:border-slate-400"
                maxLength={6}
                autoFocus
              />
            </div>
            <div>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setResetError(""); }}
                placeholder="New password (min 6 characters)"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-base transition-colors outline-none focus:border-slate-400"
              />
            </div>
            {resetError && <p className="text-red-500 text-sm">{resetError}</p>}
            <button
              type="submit"
              disabled={resetLoading || resetCode.length < 6 || newPassword.length < 6}
              className="w-full bg-slate-900 text-white font-semibold py-3 rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {resetLoading ? "Verifying…" : "Reset Password"}
            </button>
          </form>
          <button
            onClick={() => { setResetStep("email"); setResetError(""); setResetCode(""); setNewPassword(""); }}
            className="w-full mt-3 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            ← Try a different email
          </button>
        </div>
      </div>
    );
  }

  // Default login screen
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
          <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer"
            />
            <span className="text-sm text-slate-600">Remember me</span>
          </label>
          <button
            type="submit"
            className="w-full mt-4 bg-slate-900 text-white font-semibold py-3 rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all"
          >
            Enter
          </button>
        </form>
        <button
          onClick={() => setResetStep("email")}
          className="w-full mt-3 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Forgot password?
        </button>
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
  onToggleVisibility,
  onDuplicate,
}: {
  item: Accessory;
  defaultMarkup: number;
  onSave: (id: Id<"accessories">, fields: Record<string, unknown>) => void;
  onToggleVisibility: (id: Id<"accessories">, visible: boolean) => void;
  onDelete: (id: Id<"accessories">, name: string) => void;
  onDuplicate: (item: Accessory) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [cost, setCost] = useState(String(item.cost));
  const [sell, setSell] = useState(item.sellPrice != null ? String(item.sellPrice) : "");
  const [hours, setHours] = useState(item.installHours != null ? String(item.installHours) : "");
  const [markup, setMarkup] = useState(
    item.markupPercent != null ? String(item.markupPercent) : ""
  );
  const [editBrand, setEditBrand] = useState(item.brand || "");
  const [editPartNumber, setEditPartNumber] = useState(item.partNumber || "");
  const [editDescription, setEditDescription] = useState(item.series || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fitment state (for Steps & Running Boards)
  const FITMENT_CONFIG: Record<string, { models: string[]; cabTypes: string[] }> = {
    "Ford": {
      models: ["F250", "F350", "F450", "F550"],
      cabTypes: ["Single Cab", "Extended Cab (SuperCab)", "Crew Cab (SuperCrew)"],
    },
    "Ram": {
      models: ["2500", "3500", "4500", "5500"],
      cabTypes: ["Single Cab (Regular)", "Crew Cab", "Mega Cab"],
    },
    "Chevy / GMC": {
      models: ["2500", "3500", "4500", "5500", "6500"],
      cabTypes: ["Single Cab (Regular)", "Extended Cab (Double)", "Crew Cab"],
    },
  };
  const [fitment, setFitment] = useState<Array<{ make: string; models: string[]; cabTypes: string[] }>>(
    item.fitment || []
  );
  const UNIVERSAL_CAB_TYPES = ["Single Cab", "Extended Cab", "Crew Cab", "Mega Cab"];
  const [fitmentCabTypes, setFitmentCabTypes] = useState<string[]>(item.fitmentCabTypes || []);
  const FITMENT_CATEGORIES = ["Steps & Running Boards", "Front Bumpers", "Grille Guards"];
  const hasFitment = FITMENT_CATEGORIES.includes(item.category);
  const isStepsCategory = item.category === "Steps & Running Boards";  // Only steps get cab type pills
  const isUnderbodyCategory = item.category === "Toolboxes" || item.category === "Side Packs";
  const COMMON_CA_LENGTHS = ["38", "40", "42", "56", "57", "58", "60", "84"];
  const [compatibleCALengths, setCompatibleCALengths] = useState<string[]>(item.compatibleCALengths || []);

  const toggleFitmentMake = (make: string) => {
    setFitment((prev) => {
      const existing = prev.find((f) => f.make === make);
      if (existing) return prev.filter((f) => f.make !== make);
      return [...prev, { make, models: [...FITMENT_CONFIG[make].models], cabTypes: [...FITMENT_CONFIG[make].cabTypes] }];
    });
  };
  const toggleFitmentModel = (make: string, model: string) => {
    setFitment((prev) => prev.map((f) => {
      if (f.make !== make) return f;
      const has = f.models.includes(model);
      return { ...f, models: has ? f.models.filter((m) => m !== model) : [...f.models, model] };
    }));
  };
  // Image management state
  const [images, setImages] = useState<Array<{ url: string; isPrimary?: boolean; caption?: string; make?: string }>>(
    item.images || (item.imageUrl ? [{ url: item.imageUrl, isPrimary: true }] : [])
  );
  const [uploading, setUploading] = useState(false);
  const generateUploadUrl = useMutation(api.admin.generateUploadUrl);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (images.length + files.length > 6) {
      toast.error("Maximum 6 images per product");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();
        // Get the public URL for this file
        const url = `${window.location.origin.includes("localhost") ? "https://modest-albatross-638.convex.site" : "https://modest-albatross-638.convex.site"}/.well-known/storage/${storageId}`;
        // Actually we need to get the URL from Convex
        const resp = await fetch(`https://modest-albatross-638.convex.cloud/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: "admin:getStorageUrl", args: { storageId }, format: "json" }),
        });
        const data = await resp.json();
        const imgUrl = data.value || url;
        setImages((prev) => [...prev, { url: imgUrl, isPrimary: prev.length === 0 }]);
      }
      toast.success("Image uploaded");
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    }
    setUploading(false);
    e.target.value = "";
  };

  const setPrimaryImage = (idx: number) => {
    setImages((prev) => prev.map((img, i) => ({ ...img, isPrimary: i === idx })));
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // If we removed the primary, make the first one primary
      if (next.length > 0 && !next.some((img) => img.isPrimary)) {
        next[0].isPrimary = true;
      }
      return next;
    });
  };

  const addImageUrl = (url: string) => {
    if (images.length >= 6) { toast.error("Maximum 6 images"); return; }
    setImages((prev) => [...prev, { url, isPrimary: prev.length === 0 }]);
  };

  const effectiveMarkup = item.markupPercent ?? defaultMarkup;
  const effectiveSell =
    item.sellPrice != null && item.sellPrice > 0
      ? item.sellPrice
      : item.cost > 0
        ? Math.round(item.cost * (1 + effectiveMarkup / 100) * 100) / 100
        : 0;

  const handleSave = () => {
    const updates: Record<string, unknown> = {};
    const newCost = Number.parseFloat(cost);
    if (!Number.isNaN(newCost) && newCost !== item.cost) updates.cost = newCost;

    const newSell = sell.trim() === "" ? undefined : Number.parseFloat(sell);
    if (newSell !== undefined && !Number.isNaN(newSell) && newSell !== item.sellPrice) {
      updates.sellPrice = newSell;
    } else if (sell.trim() === "" && item.sellPrice != null && item.sellPrice > 0) {
      // Clear sell override — set to 0 which signals "use markup calc"
      updates.sellPrice = 0;
    }

    const newHours = hours.trim() === "" ? undefined : Number.parseFloat(hours);
    if (newHours !== undefined && !Number.isNaN(newHours) && newHours !== item.installHours) {
      updates.installHours = newHours;
    }

    const newMarkup = markup.trim() === "" ? undefined : Number.parseFloat(markup);
    if (newMarkup !== undefined && !Number.isNaN(newMarkup) && newMarkup !== item.markupPercent) {
      updates.markupPercent = newMarkup;
    }

    if (editBrand.trim() && editBrand.trim() !== item.brand) {
      updates.brand = editBrand.trim();
    }
    if (editPartNumber.trim() !== (item.partNumber || "")) {
      updates.partNumber = editPartNumber.trim();
    }
    if (editDescription.trim() && editDescription.trim() !== item.series) {
      updates.series = editDescription.trim();
    }

    // Save fitment data (for Steps, Bumpers, Grille Guards)
    if (hasFitment) {
      updates.fitment = fitment.filter((f) => f.models.length > 0 || f.cabTypes.length > 0);
      // Also update fitmentMakes for backward compat
      updates.fitmentMakes = fitment.map((f) => f.make);
      // Save universal cab types (only for Steps & Running Boards)
      if (isStepsCategory) {
        updates.fitmentCabTypes = fitmentCabTypes.length > 0 ? fitmentCabTypes : undefined;
      }
    }

    // Save compatible CA lengths (for Underbody Boxes)
    if (isUnderbodyCategory) {
      const sorted = [...compatibleCALengths].sort((a, b) => Number(a) - Number(b));
      const prev = [...(item.compatibleCALengths || [])].sort((a, b) => Number(a) - Number(b));
      if (JSON.stringify(sorted) !== JSON.stringify(prev)) {
        updates.compatibleCALengths = sorted.length > 0 ? sorted : undefined;
      }
    }

    // Save images — always save current images state
    updates.images = images;
    // Update imageUrl to primary image for backward compat
    const primary = images.find((img) => img.isPrimary) || images[0];
    if (primary) updates.imageUrl = primary.url;

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
    setEditPartNumber(item.partNumber || "");
    setEditDescription(item.series || "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <input
            type="text"
            value={editBrand}
            onChange={(e) => setEditBrand(e.target.value)}
            className="text-xs text-slate-700 font-medium bg-white/80 border border-slate-300 rounded px-2 py-1 outline-none focus:border-blue-400 w-40"
            placeholder="Brand"
          />
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
              Description
            </label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-blue-400 outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Part Number
            </label>
            <input
              type="text"
              value={editPartNumber}
              onChange={(e) => setEditPartNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-blue-400 outline-none"
            />
          </div>
          {/* Product Family removed — category is the grouping */}
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
                placeholder={String(Math.round(Number(cost || 0) * (1 + (Number(markup) || defaultMarkup) / 100)))}
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
        {/* Fitment (Steps, Bumpers, Grille Guards) */}
        {hasFitment && (
          <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
            <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">
              🚛 Vehicle Fitment
            </h4>

            {/* Universal Cab Types — only for Steps & Running Boards */}
            {isStepsCategory && (<div className="mb-3 pb-3 border-b border-blue-200">
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Cab Type</p>
              <div className="flex flex-wrap gap-1.5">
                {UNIVERSAL_CAB_TYPES.map((cab) => (
                  <button
                    key={cab}
                    type="button"
                    onClick={() => setFitmentCabTypes((prev) =>
                      prev.includes(cab) ? [] : [cab]
                    )}
                    className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                      fitmentCabTypes.includes(cab)
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white text-slate-500 border-slate-300 hover:border-green-400"
                    }`}
                  >
                    {cab}
                  </button>
                ))}
              </div>
              {fitmentCabTypes.length === 0 && (
                <p className="text-[10px] text-blue-600 mt-1">No cab type set = shows for all cab types</p>
              )}
            </div>)}

            {/* Vehicle Make selection */}
            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Vehicle Make {isStepsCategory && <span className="font-normal lowercase">(optional)</span>}</p>
            <div className="space-y-2">
              {Object.entries(FITMENT_CONFIG).map(([make, config]) => {
                const entry = fitment.find((f) => f.make === make);
                const isActive = !!entry;
                return (
                  <div key={make} className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleFitmentMake(make)}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm font-semibold text-slate-700">{make}</span>
                    </label>
                    {isActive && (
                      <div className="ml-5 space-y-1">
                        <div className="flex flex-wrap gap-1.5">
                          {config.models.map((model) => (
                            <button
                              key={model}
                              type="button"
                              onClick={() => toggleFitmentModel(make, model)}
                              className={`px-2 py-0.5 text-[11px] rounded-full border transition-colors ${
                                entry!.models.includes(model)
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-white text-slate-500 border-slate-300 hover:border-blue-400"
                              }`}
                            >
                              {model}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {fitment.length === 0 && fitmentCabTypes.length === 0 && (
              <p className="text-[11px] text-blue-600 mt-1">No fitment set = shows for all trucks (universal)</p>
            )}
          </div>
        )}

        {/* Compatible CA Lengths (Underbody Boxes) */}
        {isUnderbodyCategory && (
          <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 mb-3">
            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
              📐 Compatible CA Lengths
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_CA_LENGTHS.map((ca) => (
                <button
                  key={ca}
                  type="button"
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    compatibleCALengths.includes(ca)
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-white text-slate-600 border-slate-300 hover:border-amber-400"
                  }`}
                  onClick={() =>
                    setCompatibleCALengths((prev) =>
                      prev.includes(ca) ? prev.filter((c) => c !== ca) : [...prev, ca]
                    )
                  }
                >
                  {ca}"
                </button>
              ))}
            </div>
            {compatibleCALengths.length === 0 && (
              <p className="text-[11px] text-amber-600">No CA lengths set = shows for all CA lengths</p>
            )}
            {compatibleCALengths.length > 0 && (
              <p className="text-[11px] text-amber-700 font-medium">
                Fits: {compatibleCALengths.sort((a, b) => Number(a) - Number(b)).join('", ')}″ CA
              </p>
            )}
          </div>
        )}

        {/* Product Images */}
        <div className="pt-3 border-t border-blue-200">
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide block mb-2">
            Product Images ({images.length}/6)
          </label>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {images.map((img, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <div className={`relative group rounded-lg border-2 overflow-hidden aspect-square ${img.isPrimary ? "border-blue-500" : "border-slate-200"}`}>
                  <img src={img.url} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f1f5f9' width='100' height='100'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%2394a3b8' font-size='12'%3ENo image%3C/text%3E%3C/svg%3E"; }} />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    {!img.isPrimary && (
                      <button onClick={() => setPrimaryImage(idx)} className="bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded" title="Set as primary">★ Primary</button>
                    )}
                    <button onClick={() => removeImage(idx)} className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded" title="Remove">✕</button>
                  </div>
                  {img.isPrimary && (
                    <div className="absolute top-1 left-1 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">PRIMARY</div>
                  )}
                  {img.make && (
                    <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">{img.make}</div>
                  )}
                </div>
                {/* truck make tag badge (read-only, from existing data) */}
                {img.make && (
                  <div className="text-[10px] text-center text-slate-400 truncate">{img.make}</div>
                )}
              </div>
            ))}
            {images.length < 6 && (
              <label className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition cursor-pointer aspect-square">
                {uploading ? (
                  <div className="text-xs text-slate-400 animate-pulse">Uploading...</div>
                ) : (
                  <>
                    <Plus className="w-6 h-6 text-slate-400" />
                    <span className="text-[10px] text-slate-400 mt-1">Add Photo</span>
                  </>
                )}
                <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
              </label>
            )}
          </div>
          {/* Manual URL entry */}
          <details className="text-xs">
            <summary className="text-slate-400 cursor-pointer hover:text-slate-600">Or paste image URL</summary>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                placeholder="https://..."
                className="flex-1 px-2 py-1.5 border rounded-lg text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) { addImageUrl(val); (e.target as HTMLInputElement).value = ""; }
                  }
                }}
              />
              <button
                type="button"
                onClick={(e) => {
                  const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                  const val = input?.value?.trim();
                  if (val) { addImageUrl(val); input.value = ""; }
                }}
                className="px-2 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-300"
              >Add</button>
            </div>
          </details>
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

  const isHidden = item.isVisible === false;

  return (
    <div className={`flex items-center gap-2 ${isHidden ? "opacity-50" : ""}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility(item._id, isHidden);
        }}
        className={`shrink-0 p-1.5 rounded-lg transition-colors ${isHidden ? "text-slate-300 hover:text-green-600 hover:bg-green-50" : "text-green-600 hover:text-slate-400 hover:bg-slate-50"}`}
        title={isHidden ? "Show on Quote Builder" : "Hide from Quote Builder"}
      >
        {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate(item);
        }}
        className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
        title="Duplicate item"
      >
        <Copy className="w-3.5 h-3.5" />
        <span className="text-[10px] font-semibold">Dupe</span>
      </button>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex-1 text-left bg-white border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 hover:shadow-sm transition-all group"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-slate-900 truncate">
              {item.series}
              {isHidden && <span className="ml-1.5 text-[10px] font-normal text-slate-400">(hidden)</span>}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {item.brand}{item.partNumber ? ` · ${item.partNumber}` : ""}
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
              {item.priceUpdatedAt && (
                <div className="text-[10px] text-slate-300 mt-0.5">
                  Updated {new Date(item.priceUpdatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {item.priceUpdatedBy ? ` by ${item.priceUpdatedBy}` : ""}
                </div>
              )}
            </div>
            <Edit3 className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" />
          </div>
        </div>
      </button>
    </div>
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
  onToggleVisibility,
  onDuplicate,
  isCategoryHidden,
  onToggleCategoryVisibility,
  onRenameCategory,
  isExpanded,
  onToggle,
}: {
  name: string;
  items: Accessory[];
  defaultMarkup: number;
  onSave: (id: Id<"accessories">, fields: Record<string, unknown>) => void;
  onDelete: (id: Id<"accessories">, name: string) => void;
  onAdd: (fields: Record<string, unknown>) => void;
  onToggleVisibility: (id: Id<"accessories">, visible: boolean) => void;
  onDuplicate: (item: Accessory) => void;
  isCategoryHidden: boolean;
  onToggleCategoryVisibility: (category: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(name);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder),
    [items]
  );

  const liveCount = items.filter((i) => i.isVisible !== false).length;
  const hiddenCount = items.length - liveCount;

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== name) {
      onRenameCategory(name, trimmed);
    }
    setIsRenaming(false);
  };

  return (
    <div className="group/cat bg-white rounded-2xl border border-slate-200 overflow-hidden">
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
            {isRenaming ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameSubmit();
                    if (e.key === "Escape") { setIsRenaming(false); setRenameValue(name); }
                  }}
                  className="px-2 py-1 rounded border border-blue-400 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-200"
                  autoFocus
                  onBlur={handleRenameSubmit}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="font-semibold text-slate-900">{name}</div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setRenameValue(name); setIsRenaming(true); }}
                  className="opacity-0 group-hover/cat:opacity-100 p-0.5 rounded hover:bg-slate-200 transition"
                  title="Rename category"
                >
                  <Edit3 className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            )}
            <div className="text-xs text-slate-500">
              {items.length} items
              {hiddenCount > 0 && (
                <span className="text-slate-400"> · {liveCount} live · {hiddenCount} hidden</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isCategoryHidden && (
            <span className="bg-red-100 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full">Hidden</span>
          )}
          <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-full" title={`${liveCount} live · ${hiddenCount} hidden`}>
            {liveCount}{hiddenCount > 0 && <span className="text-slate-400">/{items.length}</span>}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleCategoryVisibility(name); }}
            className={`p-1.5 rounded-lg transition-colors ${isCategoryHidden ? "bg-red-50 text-red-400 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
            title={isCategoryHidden ? "Show category on Quote Builder" : "Hide category from Quote Builder"}
          >
            {isCategoryHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
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
              onToggleVisibility={onToggleVisibility}
              onDuplicate={onDuplicate}
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
const TEAM_MEMBERS = [
  { name: "Jon Cochrum", email: "jon.cochrum@trailerplace.com" },
  { name: "Craig Gingles", email: "craig.gingles@trailerplace.com" },
  { name: "George Silvas", email: "george.silvas@startruckequipment.com" },
  { name: "Justin Juarez", email: "justin.juarez@startruckequipment.com" },
];

/* ──────────────────── CATEGORY ORDER PANEL ──────────────────── */
function CategoryOrderPanel({
  categories,
  savedOrder,
  onSave,
}: {
  categories: string[];
  savedOrder: string[];
  onSave: (order: string[]) => void;
}) {
  // Build the display list: start with saved order, then append any new categories
  const buildOrderList = () => {
    const ordered: string[] = [];
    for (const c of savedOrder) {
      if (categories.includes(c)) ordered.push(c);
    }
    for (const c of categories) {
      if (!ordered.includes(c)) ordered.push(c);
    }
    return ordered;
  };

  const [order, setOrder] = useState(buildOrderList);

  // Update when categories or savedOrder change
  useEffect(() => {
    setOrder(buildOrderList());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.join(","), savedOrder.join(",")]);

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...order];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setOrder(next);
  };

  const moveDown = (idx: number) => {
    if (idx === order.length - 1) return;
    const next = [...order];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setOrder(next);
  };

  const hasChanges = JSON.stringify(order) !== JSON.stringify(buildOrderList());

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-5 h-5 text-slate-600" />
        <h3 className="font-semibold text-slate-900">Category Display Order</h3>
        <span className="text-xs text-slate-400 ml-auto">This controls the order on the customer quote builder</span>
      </div>
      <div className="space-y-1">
        {order.map((cat, idx) => (
          <div
            key={cat}
            className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 rounded-lg px-4 py-2.5 transition group"
          >
            <span className="text-sm font-mono text-slate-400 w-6 text-right">{idx + 1}</span>
            <span className="text-sm font-medium text-slate-800 flex-1">{cat}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
              <button
                onClick={() => moveUp(idx)}
                disabled={idx === 0}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move up"
              >
                <ArrowUp className="w-4 h-4 text-slate-500" />
              </button>
              <button
                onClick={() => moveDown(idx)}
                disabled={idx === order.length - 1}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move down"
              >
                <ArrowDown className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {hasChanges && (
        <div className="flex justify-end mt-4">
          <button
            onClick={() => onSave(order)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition"
          >
            <Check className="w-4 h-4" />
            Save Order
          </button>
        </div>
      )}
    </div>
  );
}

function SettingsPanel({
  defaultMarkup,
  laborRate,
}: {
  defaultMarkup: number;
  laborRate: number;
}) {
  const updateSetting = useMutation(api.admin.updateSetting);
  const upsertSetting = useMutation(api.settings.upsert);
  const notifyRecipientsRaw = useQuery(api.settings.get, { key: "depositNotifyRecipients" });
  const [localMarkup, setLocalMarkup] = useState(String(defaultMarkup));
  const [localRate, setLocalRate] = useState(String(laborRate));
  const [saved, setSaved] = useState(false);

  // Parse notification recipients from settings
  const notifyRecipients: string[] = useMemo(() => {
    if (!notifyRecipientsRaw) return [];
    try { return JSON.parse(notifyRecipientsRaw); } catch { return []; }
  }, [notifyRecipientsRaw]);

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

  const toggleNotifyRecipient = async (email: string) => {
    const current = [...notifyRecipients];
    const idx = current.indexOf(email);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(email);
    await upsertSetting({ key: "depositNotifyRecipients", value: JSON.stringify(current) });
    toast.success("Notification recipients updated");
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

      {/* Deposit notification recipients */}
      <div className="pt-3 border-t border-slate-100">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Deposit Notification Recipients
        </h4>
        <p className="text-xs text-slate-400 mb-3">
          The salesperson on the quote always gets notified. Check additional team members below to also receive deposit emails.
        </p>
        <div className="space-y-2">
          {TEAM_MEMBERS.map((member) => (
            <label
              key={member.email}
              className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition"
            >
              <input
                type="checkbox"
                checked={notifyRecipients.includes(member.email)}
                onChange={() => toggleNotifyRecipient(member.email)}
                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
              />
              <div>
                <div className="text-sm font-medium text-slate-900">{member.name}</div>
                <div className="text-xs text-slate-400">{member.email}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── MAIN ADMIN PAGE ──────────────────── */
/* ──────────────────── QUOTES PANEL ──────────────────── */
const PIPELINE_STAGES = [
  { key: "new", label: "New", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { key: "contacted", label: "Contacted", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { key: "quoted", label: "Quoted", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { key: "scheduled", label: "Scheduled", color: "bg-green-100 text-green-800 border-green-200" },
  { key: "completed", label: "Completed", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { key: "lost", label: "Lost", color: "bg-red-100 text-red-800 border-red-200" },
] as const;

const SALESPERSON_LIST = ["Craig Gingles", "George Silvas", "Justin Juarez", "Jon Cochrum"];

const ACTION_TYPES = [
  { key: "note", label: "Note", icon: MessageSquare },
  { key: "call", label: "Call", icon: Phone },
  { key: "email", label: "Email", icon: Mail },
  { key: "text", label: "Text", icon: Send },
] as const;

function QuotesPanel() {
  const quotes = useQuery(api.quotes.listRecent);
  const overrideSchedule = useMutation(api.quotes.overrideSchedule);
  const updatePipeline = useMutation(api.quotes.updatePipeline);
  const assignSalesperson = useMutation(api.quotes.assignSalesperson);
  const addNote = useMutation(api.quotes.addNote);
  const setFollowUp = useMutation(api.quotes.setFollowUp);
  const markLost = useMutation(api.quotes.markLost);
  const setJobType = useMutation(api.quotes.setJobType);

  const [overrideSlug, setOverrideSlug] = useState<string | null>(null);
  const [overrideName, setOverrideName] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideDate, setOverrideDate] = useState("");
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [noteText, setNoteText] = useState("");
  const [noteAction, setNoteAction] = useState<string>("note");
  const [noteBy, setNoteBy] = useState("");
  const [followUpId, setFollowUpId] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [lostId, setLostId] = useState<string | null>(null);
  const [stageChangeId, setStageChangeId] = useState<string | null>(null);
  const [stageChangeKey, setStageChangeKey] = useState<string>("");
  const [stageChangeBy, setStageChangeBy] = useState<string>("");
  const [lostReason, setLostReason] = useState("");
  const [lostBy, setLostBy] = useState("");

  const handleOverride = async () => {
    if (!overrideSlug || !overrideName.trim() || !overrideReason.trim() || !overrideDate) {
      toast.error("All override fields are required");
      return;
    }
    try {
      await overrideSchedule({
        slug: overrideSlug,
        scheduledDate: overrideDate,
        overrideBy: overrideName.trim(),
        overrideReason: overrideReason.trim(),
      });
      toast.success("Quote scheduled (deposit waived)");
      setOverrideSlug(null);
      setOverrideName("");
      setOverrideReason("");
      setOverrideDate("");
    } catch {
      toast.error("Failed to override");
    }
  };

  if (!quotes) return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full" /></div>;

  // Compute pipeline stage for each quote
  const quotesWithStage = quotes.map((q) => {
    const partsTotal = (q.items || []).reduce((s: number, i: { unitPrice: number; quantity: number }) => s + i.unitPrice * i.quantity, 0);
    const installTotal = (q.items || []).reduce((s: number, i: { installHours: number; quantity: number }) => s + i.installHours * q.laborRate * i.quantity, 0);
    const grand = partsTotal + installTotal + (q.inventoryPrice || 0);
    const isPaid = q.depositStatus === "paid";
    const isWaived = q.depositStatus === "waived";

    // Derive pipeline stage if not explicitly set
    let stage = q.pipelineStage || "new";
    if (!q.pipelineStage) {
      if (isPaid || isWaived) stage = "scheduled";
      else if (q.status === "sent") stage = "quoted";
    }

    return { ...q, grand, isPaid, isWaived, stage };
  });

  // Stage counts
  const stageCounts = PIPELINE_STAGES.reduce((acc, s) => {
    acc[s.key] = quotesWithStage.filter((q) => q.stage === s.key).length;
    return acc;
  }, {} as Record<string, number>);

  const filtered = stageFilter === "all" ? quotesWithStage : quotesWithStage.filter((q) => q.stage === stageFilter);

  // Helper: format relative time
  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-4">
      {/* Pipeline summary bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setStageFilter("all")}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            stageFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All ({quotesWithStage.length})
        </button>
        {PIPELINE_STAGES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStageFilter(s.key)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              stageFilter === s.key ? "bg-slate-900 text-white" : `${s.color} border hover:opacity-80`
            }`}
          >
            {s.label} ({stageCounts[s.key] || 0})
          </button>
        ))}
      </div>

      {/* Quotes list */}
      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-500 text-sm">
          {stageFilter === "all" ? "No quotes yet" : `No ${stageFilter} quotes`}
        </div>
      )}

      {filtered.map((q) => {
        const isExpanded = expandedQuote === q._id;
        const stageInfo = PIPELINE_STAGES.find((s) => s.key === q.stage);
        const hasFollowUp = q.followUpDate && new Date(q.followUpDate) <= new Date();

        return (
          <div key={q._id} className={`bg-white rounded-xl border ${hasFollowUp ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200"} overflow-hidden`}>
            {/* Header — always visible */}
            <button
              onClick={() => setExpandedQuote(isExpanded ? null : q._id)}
              className="w-full p-4 text-left hover:bg-slate-50/50 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-slate-900 truncate">{q.customerName || "No name"}</span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{q.slug}</span>
                    {stageInfo && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stageInfo.color}`}>
                        {stageInfo.label}
                      </span>
                    )}
                    {hasFollowUp && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse">
                        Follow-up due
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>{q.vehicleInfo || q.truckMake || "No vehicle"}</span>
                    <span className="font-semibold text-slate-700">${q.grand.toLocaleString()}</span>
                    {q.assignedTo && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {q.assignedTo.split(" ")[0]}
                      </span>
                    )}
                    {q._creationTime && <span>{timeAgo(q._creationTime)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {q.isPaid && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                      <Check className="w-3 h-3" /> Paid
                    </span>
                  )}
                  {q.isWaived && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                      Waived
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </div>

              {q.scheduledDate && (
                <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Install: {new Date(q.scheduledDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  {q.jobType && <span className="ml-2 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded capitalize">{q.jobType}</span>}
                </p>
              )}

              {/* Contact info preview */}
              {(q.customerPhone || q.customerEmail) && (
                <div className="flex gap-3 mt-1 text-[11px] text-slate-400">
                  {q.customerPhone && <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {q.customerPhone}</span>}
                  {q.customerEmail && <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> {q.customerEmail}</span>}
                </div>
              )}
            </button>

            {/* Expanded detail — CRM actions */}
            {isExpanded && (
              <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/50">
                {/* Pipeline stage selector */}
                <div>
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide block mb-1.5">Pipeline Stage</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PIPELINE_STAGES.filter(s => s.key !== "lost").map((s) => (
                      <button
                        key={s.key}
                        onClick={() => {
                          if (s.key === q.stage) return;
                          setStageChangeId(q._id);
                          setStageChangeKey(s.key);
                          setStageChangeBy("");
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          q.stage === s.key ? "ring-2 ring-slate-900 " + s.color : s.color + " opacity-50 hover:opacity-100"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                    {stageChangeId === q._id && stageChangeKey && (
                      <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-1.5">
                        <select value={stageChangeBy} onChange={(e) => setStageChangeBy(e.target.value)} className="text-xs border rounded-lg px-2 py-1">
                          <option value="">Who's changing this?</option>
                          {SALESPERSON_LIST.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <button
                          disabled={!stageChangeBy}
                          onClick={() => { updatePipeline({ id: q._id as Id<"quotes">, pipelineStage: stageChangeKey, by: stageChangeBy }); setStageChangeId(null); }}
                          className="px-2 py-1 bg-slate-900 text-white text-xs rounded-lg disabled:opacity-40"
                        >Save</button>
                        <button onClick={() => setStageChangeId(null)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
                      </div>
                    )}
                    <button
                      onClick={() => setLostId(q._id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        q.stage === "lost" ? "ring-2 ring-slate-900 bg-red-100 text-red-800" : "bg-red-100 text-red-800 opacity-50 hover:opacity-100"
                      }`}
                    >
                      Lost
                    </button>
                  </div>
                </div>

                {/* Lost reason form */}
                {lostId === q._id && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                    <p className="text-xs font-semibold text-red-800">Mark as Lost</p>
                    <input
                      type="text"
                      value={lostReason}
                      onChange={(e) => setLostReason(e.target.value)}
                      placeholder="Reason..."
                      className="w-full text-sm border rounded-lg px-3 py-2"
                    />
                    <select value={lostBy} onChange={(e) => setLostBy(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2">
                      <option value="">Who is logging this...</option>
                      {SALESPERSON_LIST.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { if (lostBy && lostReason) { markLost({ id: q._id as Id<"quotes">, reason: lostReason, by: lostBy }); setLostId(null); setLostReason(""); setLostBy(""); } }}
                        disabled={!lostBy || !lostReason}
                        className="flex-1 px-3 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                      >Confirm</button>
                      <button onClick={() => { setLostId(null); setLostReason(""); setLostBy(""); }} className="px-3 py-2 bg-slate-100 text-xs rounded-lg">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Assign salesperson + job type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide block mb-1">Assigned To</label>
                    <select
                      value={q.assignedTo || ""}
                      onChange={(e) => {
                        const by = q.assignedTo ? q.assignedTo : "System";
                        assignSalesperson({ id: q._id as Id<"quotes">, assignedTo: e.target.value, by });
                      }}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="">Unassigned</option>
                      {SALESPERSON_LIST.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide block mb-1">Job Type</label>
                    <select
                      value={q.jobType || ""}
                      onChange={(e) => {
                        if (e.target.value) setJobType({ id: q._id as Id<"quotes">, jobType: e.target.value, by: q.assignedTo || "Admin" });
                      }}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="">Select...</option>
                      <option value="waiter">Waiter</option>
                      <option value="drop-off">Drop Off</option>
                    </select>
                  </div>
                </div>

                {/* Follow-up date */}
                <div>
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide block mb-1">Follow-up Date</label>
                  {followUpId === q._id ? (
                    <div className="flex gap-2">
                      <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="flex-1 text-sm border rounded-lg px-3 py-2" />
                      <button
                        onClick={() => {
                          if (followUpDate) {
                            setFollowUp({ id: q._id as Id<"quotes">, followUpDate, by: q.assignedTo || "Admin" });
                            setFollowUpId(null); setFollowUpDate("");
                          }
                        }}
                        className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg"
                      >Set</button>
                      <button onClick={() => { setFollowUpId(null); setFollowUpDate(""); }} className="px-3 py-2 bg-slate-100 text-xs rounded-lg">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setFollowUpId(q._id)}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <Clock className="w-3 h-3" />
                      {q.followUpDate
                        ? `Follow-up: ${new Date(q.followUpDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} — Change`
                        : "Set follow-up date"}
                    </button>
                  )}
                </div>

                {/* Override schedule (existing feature) */}
                {!q.isPaid && !q.isWaived && (
                  <div>
                    {overrideSlug === q.slug ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                        <p className="text-xs font-semibold text-amber-800">⚠️ Schedule without deposit</p>
                        <select value={overrideName} onChange={(e) => setOverrideName(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2">
                          <option value="">Select team member...</option>
                          {SALESPERSON_LIST.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <input type="date" value={overrideDate} onChange={(e) => setOverrideDate(e.target.value)}
                          className="w-full text-sm border rounded-lg px-3 py-2"
                          min={new Date(Date.now() + 86400000).toISOString().split("T")[0]} />
                        <input type="text" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)}
                          placeholder="Reason for waiving deposit..."
                          className="w-full text-sm border rounded-lg px-3 py-2" />
                        <div className="flex gap-2">
                          <button onClick={handleOverride} disabled={!overrideName || !overrideReason.trim() || !overrideDate}
                            className="flex-1 px-3 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">Confirm Override</button>
                          <button onClick={() => { setOverrideSlug(null); setOverrideName(""); setOverrideReason(""); setOverrideDate(""); }}
                            className="px-3 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setOverrideSlug(q.slug)}
                        className="text-xs text-amber-600 hover:text-amber-800 font-medium">
                        Schedule without deposit →
                      </button>
                    )}
                  </div>
                )}

                {q.overrideReason && (
                  <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded">
                    Override: {q.overrideReason} <span className="text-amber-500">by {q.overrideBy}</span>
                  </p>
                )}

                {/* Add note / log activity */}
                <div className="border-t border-slate-200 pt-3">
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide block mb-1.5">Log Activity</label>
                  <div className="flex gap-1.5 mb-2">
                    {ACTION_TYPES.map((a) => (
                      <button
                        key={a.key}
                        onClick={() => setNoteAction(a.key)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                          noteAction === a.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        <a.icon className="w-3 h-3" /> {a.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <select value={noteBy} onChange={(e) => setNoteBy(e.target.value)} className="text-sm border rounded-lg px-2 py-2 w-36">
                      <option value="">Who...</option>
                      {SALESPERSON_LIST.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <input type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)}
                      placeholder={`Add ${noteAction}...`}
                      className="flex-1 text-sm border rounded-lg px-3 py-2"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && noteText.trim() && noteBy) {
                          addNote({ id: q._id as Id<"quotes">, action: noteAction, by: noteBy, detail: noteText.trim() });
                          setNoteText("");
                        }
                      }} />
                    <button
                      onClick={() => {
                        if (noteText.trim() && noteBy) {
                          addNote({ id: q._id as Id<"quotes">, action: noteAction, by: noteBy, detail: noteText.trim() });
                          setNoteText("");
                        }
                      }}
                      disabled={!noteText.trim() || !noteBy}
                      className="px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg disabled:opacity-40"
                    >Add</button>
                  </div>
                </div>

                {/* Activity log */}
                {q.activityLog && q.activityLog.length > 0 && (
                  <div className="border-t border-slate-200 pt-3">
                    <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide block mb-2">Activity Log</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {[...q.activityLog].reverse().map((entry: { timestamp: number; action: string; by: string; detail: string }, i: number) => {
                        const actionIcon = entry.action === "call" ? "📞" : entry.action === "email" ? "📧" : entry.action === "text" ? "💬" : entry.action === "status_change" ? "🔄" : entry.action === "assigned" ? "👤" : "📝";
                        return (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className="mt-0.5">{actionIcon}</span>
                            <div className="flex-1">
                              <span className="font-medium text-slate-700">{entry.by}</span>
                              <span className="text-slate-400 ml-1">{entry.detail}</span>
                              <span className="text-slate-300 ml-2">{timeAgo(entry.timestamp)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quote items summary */}
                {q.items && q.items.length > 0 && (
                  <div className="border-t border-slate-200 pt-3">
                    <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide block mb-1.5">Quote Items</label>
                    <div className="space-y-1">
                      {q.inventoryTitle && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600">🛏️ {q.inventoryTitle}</span>
                          <span className="font-medium">${(q.inventoryPrice || 0).toLocaleString()}</span>
                        </div>
                      )}
                      {q.items.map((item: { series: string; brand: string; unitPrice: number; quantity: number }, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span className="text-slate-600">{item.series} <span className="text-slate-400">({item.brand})</span></span>
                          <span className="font-medium">${(item.unitPrice * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs font-bold pt-1 border-t border-slate-100">
                        <span>Total</span>
                        <span>${q.grand.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AdminPage() {
  const [authed, setAuthed] = useState(() => {
    return localStorage.getItem("admin_auth") === "1";
  });
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [showCategoryOrder, setShowCategoryOrder] = useState(false);
  const [activeTab, setActiveTab] = useState<"accessories" | "quotes">("accessories");

  const allItems = useQuery(api.admin.listAllForAdmin);
  const defaultMarkup = useQuery(api.accessories.getDefaultMarkup);
  const laborRate = useQuery(api.accessories.getLaborRate);

  const updateAccessory = useMutation(api.admin.updateAccessory);
  const deleteAccessory = useMutation(api.admin.deleteAccessory);
  const addAccessory = useMutation(api.admin.addAccessory);
  const hiddenCategories = useQuery(api.admin.getHiddenCategories) ?? [];
  const toggleCategoryVisibilityMut = useMutation(api.admin.toggleCategoryVisibility);
  const renameCategoryMut = useMutation(api.admin.renameCategory);
  const categoryOrder = useQuery(api.admin.getCategoryOrder) ?? [];
  const setCategoryOrderMut = useMutation(api.admin.setCategoryOrder);

  const handleAuth = useCallback((remember: boolean) => {
    setAuthed(true);
    if (remember) {
      localStorage.setItem("admin_auth", "1");
      localStorage.setItem("admin_remember", "1");
    } else {
      localStorage.removeItem("admin_auth");
      localStorage.removeItem("admin_remember");
    }
  }, []);

  // Group by category
  const { categories, filteredGrouped, totalCount } = useMemo(() => {
    if (!allItems) return { categories: [], filteredGrouped: new Map(), totalCount: 0 };

    const grouped = new Map<string, Accessory[]>();
    for (const item of allItems) {
      const list = grouped.get(item.category) || [];
      list.push(item);
      grouped.set(item.category, list);
    }

    const catList = Array.from(grouped.keys()).sort((a, b) => {
      const oa = categoryOrder.indexOf(a);
      const ob = categoryOrder.indexOf(b);
      const ia = oa === -1 ? 999 : oa;
      const ib = ob === -1 ? 999 : ob;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b);
    });

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
  }, [allItems, search, selectedCategory, categoryOrder]);

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
      await updateAccessory({ id, updatedBy: "Admin", ...fields } as Parameters<typeof updateAccessory>[0]);
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

  const handleDuplicate = async (item: Accessory) => {
    try {
      // Only include fields that addAccessory accepts — no mapPrice, retailPrice, priceUpdatedAt, etc.
      const fields: Parameters<typeof addAccessory>[0] = {
        category: item.category,
        brand: item.brand,
        series: `${item.series} (Copy)`,
        partNumber: item.partNumber ? `${item.partNumber}-COPY` : `COPY-${Date.now()}`,
        cost: item.cost,
        source: item.source || "manual",
        sortOrder: (item.sortOrder || 0) + 1,
        isVisible: false, // Start hidden so duplicate doesn't show to customers
      };
      // Only add optional fields if they have values
      if (item.sellPrice != null) fields.sellPrice = item.sellPrice;
      if (item.installHours != null) fields.installHours = item.installHours;
      if (item.markupPercent != null) fields.markupPercent = item.markupPercent;
      if (item.maxQty != null) fields.maxQty = item.maxQty;
      if (item.notes) fields.notes = item.notes;
      if (item.imageUrl) fields.imageUrl = item.imageUrl;
      if (item.fitmentMakes?.length) fields.fitmentMakes = item.fitmentMakes;
      if (item.fitment?.length) fields.fitment = item.fitment;
      if (item.fitmentCabTypes?.length) fields.fitmentCabTypes = item.fitmentCabTypes;
      if (item.images?.length) fields.images = item.images;
      if (item.productFamily) fields.productFamily = item.productFamily;
      if (item.compatibleCALengths?.length) fields.compatibleCALengths = item.compatibleCALengths;
      await addAccessory(fields);
      toast.success(`Duplicated "${item.series}" — edit the copy to make it unique, then make it visible`);
    } catch (err) {
      console.error("Duplicate failed:", err);
      toast.error("Failed to duplicate item");
    }
  };

  const handleToggleCategoryVisibility = async (category: string) => {
    try {
      await toggleCategoryVisibilityMut({ category });
      const isHidden = hiddenCategories.includes(category);
      toast.success(isHidden ? `"${category}" now visible on Quote Builder` : `"${category}" hidden from Quote Builder`);
    } catch {
      toast.error("Failed to update category visibility");
    }
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    try {
      const result = await renameCategoryMut({ oldName, newName });
      toast.success(`Renamed "${oldName}" → "${result?.newName ?? newName}" (${result?.updated ?? 0} items updated)`);
    } catch {
      toast.error("Failed to rename category");
    }
  };

  const handleToggleVisibility = async (id: Id<"accessories">, currentlyHidden: boolean) => {
    try {
      await updateAccessory({ id, isVisible: currentlyHidden ? true : false } as Parameters<typeof updateAccessory>[0]);
      toast.success(currentlyHidden ? "Now visible on Quote Builder" : "Hidden from Quote Builder");
    } catch {
      toast.error("Failed to update visibility");
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
        <div className="max-w-6xl mx-auto px-4 py-3">
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
              onClick={() => {
                const next = !showSettings;
                setShowSettings(next);
                if (next) {
                  setActiveTab("accessories");
                  setTimeout(() => document.getElementById("settings-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                showSettings
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={() => {
                const next = !showCategoryOrder;
                setShowCategoryOrder(next);
                if (next) {
                  setActiveTab("accessories");
                  setTimeout(() => document.getElementById("category-order-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                showCategoryOrder
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Layers className="w-4 h-4" />
              Category Order
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            <button
              onClick={() => setActiveTab("accessories")}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
                activeTab === "accessories"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Accessories
            </button>
            <button
              onClick={() => setActiveTab("quotes")}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
                activeTab === "quotes"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Quotes
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4">
        {activeTab === "quotes" ? (
          <QuotesPanel />
        ) : (
          <div className="flex gap-4">
            {/* Category Sidebar */}
            <div className="w-56 shrink-0 hidden md:block">
              <div className="sticky top-4 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-2">Categories</p>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                    !selectedCategory
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  All ({allItems?.length ?? 0})
                </button>
                {categories.map((cat) => {
                  const catItems = allItems?.filter((i: { category: string }) => i.category === cat) ?? [];
                  const count = catItems.length;
                  const catHiddenCount = catItems.filter((i) => i.isVisible === false).length;
                  const catLiveCount = count - catHiddenCount;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex justify-between items-center ${
                        cat === selectedCategory
                          ? "bg-slate-900 text-white font-semibold"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span className="truncate">{cat}</span>
                      <span className={`text-xs ml-1 shrink-0 ${cat === selectedCategory ? "text-slate-300" : "text-slate-400"}`}>
                        {catHiddenCount > 0 ? `${catLiveCount}/${count}` : count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0 space-y-4">
            {/* Settings panel */}
            {showSettings && (
              <div id="settings-panel">
                <SettingsPanel
                  defaultMarkup={defaultMarkup}
                  laborRate={laborRate ?? 150}
                />
              </div>
            )}

            {/* Category Order panel */}
            {showCategoryOrder && (
              <div id="category-order-panel">
                <CategoryOrderPanel
                  categories={categories}
                  savedOrder={categoryOrder}
                  onSave={async (order) => {
                    try {
                      await setCategoryOrderMut({ order });
                      toast.success("Category order saved!");
                    } catch {
                      toast.error("Failed to save category order");
                    }
                  }}
                />
              </div>
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

            {/* Mobile-only horizontal category filter (hidden on desktop) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:hidden">
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
                onToggleVisibility={handleToggleVisibility}
                onDuplicate={handleDuplicate}
                isCategoryHidden={hiddenCategories.includes(cat)}
                onToggleCategoryVisibility={handleToggleCategoryVisibility}
                onRenameCategory={handleRenameCategory}
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
            </div>
          </div>
        )}

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
}
