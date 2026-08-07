import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import { ToastProvider } from "./components/ui/ToastProvider";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { AppShortcuts } from "./components/layout/AppShortcuts";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";

/**
 * Login and Dashboard stay eager: one of them is the first paint on every visit,
 * and deferring those would trade a smaller bundle for a slower start, which is
 * the wrong way round.
 *
 * BoardView is split despite being central, because it is the only route that
 * needs dnd-kit. Eager, that library sat in the initial bundle for every visitor
 * including one who only ever looks at the dashboard.
 *
 * The rest are split out. Teams pulls in the charts, and most sessions never open
 * it, /admin or /my-tasks at all. `.then` picks the named export because these
 * modules do not default-export.
 */
const BoardView = lazy(() =>
  import("./pages/BoardView").then((m) => ({ default: m.BoardView })),
);
const Landing = lazy(() =>
  import("./pages/Landing").then((m) => ({ default: m.Landing })),
);
const Docs = lazy(() => import("./pages/Docs").then((m) => ({ default: m.Docs })));
const AcceptInvite = lazy(() =>
  import("./pages/AcceptInvite").then((m) => ({ default: m.AcceptInvite })),
);
const Admin = lazy(() => import("./pages/Admin").then((m) => ({ default: m.Admin })));
const Teams = lazy(() => import("./pages/Teams").then((m) => ({ default: m.Teams })));
const MyTasks = lazy(() =>
  import("./pages/MyTasks").then((m) => ({ default: m.MyTasks })),
);
const NotFound = lazy(() =>
  import("./pages/NotFound").then((m) => ({ default: m.NotFound })),
);
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Loader } from "./components/ui/Loader";
import { useTheme } from "./context/ThemeContext";
import { useKanbanStore } from "./store/kanbanStore";
import { useStore } from "./store/store";
import { PATHS } from "./routes";
import { useMediaQuery, NARROW_VIEWPORT } from "./hooks/useMediaQuery";

function App() {
  useEffect(() => {
    // Remove stale localStorage from previous storage versions
    localStorage.removeItem("kanban-storage");
    localStorage.removeItem("kanban_user");
    // NOTE: Do NOT clear "cookieFallback" here - it's the Appwrite SDK's
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

      <Suspense fallback={<Loader fullScreen />}>
        <Routes>
        {/* Public front door. Signed-in visitors are sent to their boards by the
            page itself, so a bookmark of "/" still lands somewhere useful. */}
        <Route path={PATHS.landing} element={<Landing />} />

        {/* Public: somebody deciding whether to run this reads it before signing up. */}
        <Route path={PATHS.docs} element={<Docs />} />

        {/* Public route - Login */}
        <Route path={PATHS.login} element={<Login />} />

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

                {/* First in the tab order: a keyboard user should not have to walk
                    the whole board list to reach the board. */}
                <a className="skip-link" href="#main-content">
                  Skip to content
                </a>

                <main
                  id="main-content"
                  className={`main-content ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
                >
                  <Header />
                  {/* Inside the protected layout, so shortcuts exist only where
                      there is something to act on. */}
                  <AppShortcuts />
                  <Outlet />
                </main>
              </>
            </ProtectedRoute>
          }
        >
          {/* Nested protected routes. The dashboard moved off "/" when the
              landing page took it. */}
          <Route path={PATHS.dashboard} element={<Dashboard />} />
          <Route path="/board/:boardId" element={<BoardView />} />
          <Route path={PATHS.myTasks} element={<MyTasks />} />
          <Route path={PATHS.teams} element={<Teams />} />
          <Route path={PATHS.admin} element={<Admin />} />
        </Route>

          {/* 404 - catches all unknown routes for both auth states */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
