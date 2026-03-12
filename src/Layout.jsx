import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Route, Users, Settings, FileText, CalendarClock, Navigation, Car, Wrench } from "lucide-react";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69134403eb36c8c975510ceb/250c13318_image.png";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [userRole, setUserRole] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(user => setUserRole(user?.role || "user"));
  }, []);

  // Páginas do motorista - não mostram header principal
  const driverPages = ["DriverDashboard", "DriverRouteView", "DriverHistory", "DriverVehicle", "DriverProfile"];
  const isDriverPage = driverPages.includes(currentPageName);

  // Se for motorista, redireciona para área do motorista
  React.useEffect(() => {
    if (userRole === "motorista" && !isDriverPage) {
      window.location.href = createPageUrl("DriverDashboard");
    }
  }, [userRole, isDriverPage]);

  // Se é página de motorista, não mostra o layout principal
  if (isDriverPage) {
    return <>{children}</>;
  }

  const navigationItems = [
    {
      title: "Otimizador",
      url: createPageUrl("Optimizer"),
      icon: Route,
    },
    {
      title: "Agendados",
      url: createPageUrl("Agendados"),
      icon: CalendarClock,
    },
    {
      title: "Clientes",
      url: createPageUrl("Clientes"),
      icon: Users,
    },
    {
      title: "Veículos",
      url: createPageUrl("Veiculos"),
      icon: Car,
    },
    {
      title: "Relatórios",
      url: createPageUrl("Relatorios"),
      icon: FileText,
    },
    {
      title: "Manutenção",
      url: createPageUrl("Manutencao"),
      icon: Wrench,
    },
    {
      title: "Em Rota",
      url: createPageUrl("RotasEmAndamento"),
      icon: Navigation,
    },
    {
      title: "Configurações",
      url: createPageUrl("Configuracoes"),
      icon: Settings,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Navigation */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img 
                src={LOGO_URL} 
                alt="Logo" 
                className="w-12 h-12 object-contain"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Sistema de Rotas
                </h1>
                <p className="text-xs text-gray-500">Otimização de Entregas</p>
              </div>
            </div>

            <nav className="flex gap-2">
              {navigationItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <Link
                    key={item.title}
                    to={item.url}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{item.title}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}