import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Wrench, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function MaintenanceAlerts({ currentUser }) {
  const [dismissed, setDismissed] = React.useState([]);

  const { data: veiculos = [] } = useQuery({
    queryKey: ["veiculos-alerts", currentUser?.email],
    queryFn: () => base44.entities.Veiculo.filter({ owner: currentUser.email, ativo: true }),
    enabled: !!currentUser,
  });

  const { data: registros = [] } = useQuery({
    queryKey: ["manutencao-alerts", currentUser?.email],
    queryFn: () => base44.entities.ManutencaoVeiculo.filter(
      { owner: currentUser.email },
      "-data",
      200
    ),
    enabled: !!currentUser,
  });

  // Para cada veículo, encontrar o km mais recente e a última manutenção preventiva
  const alerts = React.useMemo(() => {
    if (!veiculos.length || !registros.length) return [];

    const result = [];

    veiculos.forEach(veiculo => {
      const veiculoRegistros = registros
        .filter(r => r.veiculo_id === veiculo.id && r.km_atual)
        .sort((a, b) => new Date(b.data) - new Date(a.data));

      if (veiculoRegistros.length === 0) return;

      const kmAtual = Math.max(...veiculoRegistros.map(r => Number(r.km_atual)));

      // Última troca de óleo
      const ultimaTrocaOleo = veiculoRegistros.find(r => r.tipo === "troca_oleo");
      if (ultimaTrocaOleo) {
        const kmDesdeTroca = kmAtual - Number(ultimaTrocaOleo.km_atual);
        // Alerta se falta menos de 1000km para os 5000km de intervalo
        if (kmDesdeTroca >= 4000) {
          result.push({
            id: `oleo-${veiculo.id}`,
            veiculo: `${veiculo.descricao} (${veiculo.placa})`,
            tipo: "Troca de Óleo",
            mensagem: `${kmDesdeTroca.toLocaleString("pt-BR")} km desde a última troca. Próxima em ~${(5000 - kmDesdeTroca).toLocaleString("pt-BR")} km.`,
            urgente: kmDesdeTroca >= 5000,
          });
        }
      }

      // Última manutenção preventiva
      const ultimaPreventiva = veiculoRegistros.find(r => r.tipo === "manutencao_preventiva");
      if (ultimaPreventiva) {
        const kmDesdePreventiva = kmAtual - Number(ultimaPreventiva.km_atual);
        // Alerta se falta menos de 2000km para os 10000km de intervalo
        if (kmDesdePreventiva >= 8000) {
          result.push({
            id: `preventiva-${veiculo.id}`,
            veiculo: `${veiculo.descricao} (${veiculo.placa})`,
            tipo: "Manutenção Preventiva",
            mensagem: `${kmDesdePreventiva.toLocaleString("pt-BR")} km desde a última revisão. Próxima em ~${(10000 - kmDesdePreventiva).toLocaleString("pt-BR")} km.`,
            urgente: kmDesdePreventiva >= 10000,
          });
        }
      }

      // Último pneu
      const ultimoPneu = veiculoRegistros.find(r => r.tipo === "pneu");
      if (ultimoPneu) {
        const kmDesdePneu = kmAtual - Number(ultimoPneu.km_atual);
        if (kmDesdePneu >= 38000) {
          result.push({
            id: `pneu-${veiculo.id}`,
            veiculo: `${veiculo.descricao} (${veiculo.placa})`,
            tipo: "Troca de Pneus",
            mensagem: `${kmDesdePneu.toLocaleString("pt-BR")} km desde a última troca. Próxima em ~${(40000 - kmDesdePneu).toLocaleString("pt-BR")} km.`,
            urgente: kmDesdePneu >= 40000,
          });
        }
      }
    });

    return result;
  }, [veiculos, registros]);

  const visibleAlerts = alerts.filter(a => !dismissed.includes(a.id));

  if (visibleAlerts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 space-y-2"
    >
      <AnimatePresence>
        {visibleAlerts.map(alert => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm ${
              alert.urgente
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              alert.urgente ? "bg-red-100" : "bg-amber-100"
            }`}>
              {alert.urgente ? (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              ) : (
                <Wrench className="w-4 h-4 text-amber-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{alert.veiculo} — {alert.tipo}</p>
              <p className="text-xs opacity-80">{alert.mensagem}</p>
            </div>
            <button
              onClick={() => setDismissed(prev => [...prev, alert.id])}
              className="shrink-0 p-1 rounded hover:bg-black/5"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}