import { Navigate, Route, Routes, useParams } from "react-router-dom";
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

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={false}>
        <Toaster />
        <Routes>
          <Route path="/" element={<SalesToolPage />} />
          <Route path="/quote/:slug" element={<QuoteRoute />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
