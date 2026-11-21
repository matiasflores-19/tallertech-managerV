import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthProvider.jsx';
import { UIProvider } from './context/UIProvider.jsx';
import AppLayout from './components/Layout.jsx';
import { Logo, Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Orders from './pages/Orders.jsx';
import NewOrder from './pages/NewOrder.jsx';
import QuickIntake from './pages/QuickIntake.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Repairs from './pages/Repairs.jsx';
import Clients from './pages/Clients.jsx';
import ClientDetail from './pages/ClientDetail.jsx';
import Inventory from './pages/Inventory.jsx';
import Finance from './pages/Finance.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-950">
      <Logo />
      <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner size={18} /> Iniciando TallerTech Manager…</div>
    </div>
  );
}

function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="font-mono text-5xl font-black text-tech-500/30">404</p>
      <h1 className="mt-3 text-xl font-bold text-white">Página no encontrada</h1>
      <p className="mt-1 max-w-sm text-sm text-slate-500">La ruta que buscás no existe o fue movida.</p>
      <a href="/dashboard" className="btn-primary mt-5">Volver al panel</a>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <UIProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/recepcion" element={<QuickIntake />} />
                <Route path="/ordenes" element={<Orders />} />
                <Route path="/ordenes/nueva" element={<NewOrder />} />
                <Route path="/ordenes/:id" element={<OrderDetail />} />
                <Route path="/reparaciones" element={<Repairs />} />
                <Route path="/clientes" element={<Clients />} />
                <Route path="/clientes/:id" element={<ClientDetail />} />
                <Route path="/inventario" element={<Inventory />} />
                <Route path="/finanzas" element={<Finance />} />
                <Route path="/reportes" element={<Reports />} />
                <Route path="/configuracion" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </UIProvider>
    </BrowserRouter>
  );
}
