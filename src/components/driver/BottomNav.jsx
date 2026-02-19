import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Truck, FileText, Car } from "lucide-react";

export default function BottomNav() {
  const location = useLocation();

  const isActive = (pageName) => {
    const url = createPageUrl(pageName);
    return location.pathname === url;
  };

  const navItems = [
    { pageName: "DriverDashboard", icon: Truck, label: "Principal" },
    { pageName: "DriverHistory", icon: FileText, label: "Histórico" },
    { pageName: "DriverVehicle", icon: Car, label: "Veículo" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50 safe-area-pb">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => (
          <Link
            key={item.pageName}
            to={createPageUrl(item.pageName)}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              isActive(item.pageName)
                ? "text-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}