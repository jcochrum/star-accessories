import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SalesToolPage } from "./pages/SalesToolPage";
import { QuoteViewPage } from "./pages/QuoteViewPage";
import { AdminPage } from "./pages/AdminPage";

function QuoteRoute() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <Navigate to="/" replace />;
  return <QuoteViewPage slug={slug} />;
}

/** Simple password gate for staff mode */
function StaffGate() {
  const [authed, setAuthed] = useState(() => {
    return localStorage.getItem("staff_auth") === "1" || sessionStorage.getItem("staff_auth") === "1";
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem("staff_remember") === "1";
  });
  const [showForgot, setShowForgot] = useState(false);

  if (authed) return <SalesToolPage staffMode />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold">Star Truck Equipment</h1>
          <p className="text-sm text-muted-foreground">Staff Sales Tool</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (password === "StarSales2026!" || password === "StarAdmin2026!") {
              if (rememberMe) {
                localStorage.setItem("staff_auth", "1");
                localStorage.setItem("staff_remember", "1");
              } else {
                sessionStorage.setItem("staff_auth", "1");
                localStorage.removeItem("staff_auth");
                localStorage.removeItem("staff_remember");
              }
              setAuthed(true);
            } else {
              setError(true);
            }
          }}
          className="space-y-3"
        >
          <input
            type="password"
            placeholder="Staff password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            className="w-full px-3 py-2 border rounded-md text-sm"
            autoFocus
          />
          {error && (
            <p className="text-sm text-red-500">Incorrect password</p>
          )}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 cursor-pointer"
            />
            <span className="text-sm text-muted-foreground">Remember me</span>
          </label>
          <button
            type="submit"
            className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
          >
            Sign In
          </button>
        </form>
        <button
          onClick={() => setShowForgot(!showForgot)}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Forgot password?
        </button>
        {showForgot && (
          <p className="text-xs text-muted-foreground bg-muted rounded-md p-3 text-center">
            Contact your administrator or ask in Slack for the staff password.
          </p>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={false}>
        <Toaster />
        <Routes>
          {/* Customer-facing (default) — no cost/markup data */}
          <Route path="/" element={<SalesToolPage />} />
          {/* Staff mode — password protected, full internal data */}
          <Route path="/sales" element={<StaffGate />} />
          <Route path="/quote/:slug" element={<QuoteRoute />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
