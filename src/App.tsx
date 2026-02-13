import { useEffect } from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { BoardView } from './pages/BoardView';
import { Login } from './pages/Login';
import { Admin } from './pages/Admin';
import { NotFound } from './pages/NotFound';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useTheme } from './context/ThemeContext';
import { useKanbanStore } from './store/kanbanStore';
import { useStore } from './store/store';

function App() {
  useEffect(() => {
    useStore.getState().checkSession();
  }, []);
  const { theme } = useTheme();
  const isSidebarOpen = useKanbanStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useKanbanStore((state) => state.setSidebarOpen);

  return (
    <div className={`app ${theme}`}>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: theme === 'dark' ? '#20212C' : '#FFFFFF',
            color: theme === 'dark' ? '#FFFFFF' : '#000112',
            border: `1px solid ${theme === 'dark' ? '#3E3F4E' : '#E4EBFA'}`,
          },
          success: {
            iconTheme: {
              primary: '#635FC7',
              secondary: '#FFFFFF',
            },
          },
        }}
      />
      
      <Routes>
        {/* Public route - Login */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes with shared layout */}
        <Route
          element={
            <ProtectedRoute>
              <>
                <Sidebar
                  isOpen={isSidebarOpen}
                  onToggle={() => setSidebarOpen(!isSidebarOpen)}
                />
                
                <main className={`main-content ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
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
