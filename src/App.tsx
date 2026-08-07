import { useEffect } from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import { ToastProvider } from "./components/ui/ToastProvider";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { Dashboard } from "./pages/Dashboard";
import { BoardView } from "./pages/BoardView";
import { Login } from "./pages/Login";
import { AcceptInvite } from "./pages/AcceptInvite";
import { Admin } from "./pages/Admin";
import { NotFound } from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useTheme } from "./context/ThemeContext";
import { useKanbanStore } from "./store/kanbanStore";
import { useStore } from "./store/store";
import { useMediaQuery, NARROW_VIEWPORT } from "./hooks/useMediaQuery";

function App() {
  useEffect(() => {
    // Remove stale localStorage from previous storage versions
    localStorage.removeItem("kanban-storage");
    localStorage.removeItem("kanban_user");
    // NOTE: Do NOT clear "cookieFallback" here — it's the Appwrite SDK's
    // session persistence key. Clearing it on every mount destroys active
    // sessions. It is only cleaned up in authService.logout().
    useStore.getState().checkSession();
  }, []);
  const { theme } = useTheme();
  const isSidebarOpen = useKanbanStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useKanbanStore((state) => state.setSidebarOpen);

  // Shrinking a desktop window past the drawer breakpoint would otherwise leave
  // the sidebar sitting open on top of the board.
  const isDrawer = useMediaQuery(NARROW_VIEWPORT);
  useEffect(() => {
    if (isDrawer) setSidebarOpen(false);
  }, [isDrawer, setSidebarOpen]);

  return (
    <div className={`app ${theme}`}>
      <ToastProvider />

      <Routes>
        {/* Public route - Login */}
        <Route path="/login" element={<Login />} />

        {/* Public on purpose: an invitee may not have an account yet, and this
            page is what tells them which address to register with. */}
        <Route path="/invite/:token" element={<AcceptInvite />} />

        {/* Protected routes with shared layout */}
        <Route
          element={
            <ProtectedRoute>
              <>
                <Sidebar
                  isOpen={isSidebarOpen}
                  onToggle={() => setSidebarOpen(!isSidebarOpen)}
                />

                <main
                  className={`main-content ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
                >
                  <Header />
                  <Outlet />
                </main>
              </>
            </ProtectedRoute>
          }
        >
          {/* Nested protected routes */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/board/:boardId" element={<BoardView />} />
          <Route path="/admin" element={<Admin />} />
        </Route>

        {/* 404 - catches all unknown routes for both auth states */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default App;
