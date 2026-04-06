import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { User, Mail, LogOut, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BottomNav from "../components/driver/BottomNav";

export default function DriverProfile() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    base44.auth
      .me()
      .then(setCurrentUser)
      .catch((err) => console.error("Erro ao carregar perfil:", err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await base44.auth.logout();
    } catch (err) {
      console.error("Erro ao sair:", err);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-40">
        <div className="max-w-md mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Meu Perfil</h1>
          <p className="text-sm text-gray-500">Informações da conta</p>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-500">Carregando perfil...</p>
          </div>
        ) : (
          <>
            {/* Avatar */}
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-12 h-12 text-blue-600" />
              </div>
            </div>

            {/* Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Informações de Login
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <User className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">Nome</p>
                    <p className="font-medium text-gray-900">
                      {currentUser?.full_name || "Não informado"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">
                      {currentUser?.email || "Não informado"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Logout Button */}
            <Button
              variant="destructive"
              className="w-full mt-6"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saindo...
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair da Conta
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
