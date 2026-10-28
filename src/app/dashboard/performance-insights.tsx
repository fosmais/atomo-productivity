"use client";

import { useCallback, useEffect, useState } from "react";
import { loadVyraCompletionHistory } from "./vyra-metrics-service";
import { calculateVyraMetrics, type VyraMetrics, type TaskMetric } from "./vyra-metrics";
import { generateVyraInsights } from "./vyra-insights";
import { recommendNextTask } from "./vyra-task-priority";
import { rankVyraTasks } from "./vyra-task-ranking";
import { useVyraNavigation } from "./vyra-module-context";
import {
  calculatePeriodMetrics,
  calculateCompletionSeries,
  getHistoryCoverage,
  canCompareHistory,
  type VyraPeriod,
} from "./vyra-period-metrics";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";



export default function PerformanceInsights() {
  const [metrics, setMetrics] = useState<VyraMetrics | null>(null);
  const [completionHistory, setCompletionHistory] = useState<TaskMetric[]>([]);
  const [period, setPeriod] = useState<VyraPeriod>("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const tasks = await loadVyraCompletionHistory();

      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "America/Sao_Paulo",
      });

      setMetrics(calculateVyraMetrics(tasks, today));
      setCompletionHistory(tasks);
    } catch (err) {
      setMetrics(null);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os indicadores."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const { navigateTo, navigateToTask } = useVyraNavigation();
  const insights = metrics ? generateVyraInsights(metrics) : [];

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });

  const nextTask = recommendNextTask(completionHistory, today);
  const rankedTasks = rankVyraTasks(completionHistory, today, 3);
  const periodMetrics = calculatePeriodMetrics(completionHistory, period);
  const completionSeries = calculateCompletionSeries(completionHistory, period);
  const validCompletionPoints = completionSeries.filter(
    (point) => point.completed !== null
  ).length;
  const currentCoverage = getHistoryCoverage(period);
  const previousCoverage = getHistoryCoverage(period, -1);
  const comparisonAvailable = canCompareHistory(period);

  const completionRate =
    metrics && metrics.total > 0
      ? Math.round((metrics.completed / metrics.total) * 100)
      : 0;
  const chartData = metrics
    ? [
        { name: "A fazer", value: metrics.todo },
        { name: "Em andamento", value: metrics.inProgress },
        { name: "Aguardando", value: metrics.waiting },
        { name: "Concluído", value: metrics.completed },
      ]
    : [];

  const priorityChartData = metrics
    ? [
        { name: "Alta", quantidade: metrics.highPriority },
        { name: "Média", quantidade: metrics.mediumPriority },
        { name: "Baixa", quantidade: metrics.lowPriority },
        { name: "Outras", quantidade: metrics.otherPriority },
      ]
    : [];
  const chartColors = [
    "#64748b",
    "#8b5cf6",
    "#f59e0b",
    "#22c55e",
  ];
  const cards = [
    { label: "Total de tarefas", value: metrics?.total },
    { label: "Concluídas", value: metrics?.completed },
    { label: "Em aberto", value: metrics?.pending },
    { label: "Atrasadas", value: metrics?.overdue },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Indicadores baseados nas suas tarefas cadastradas.
        </p>

        <button
          type="button"
          onClick={() => void loadMetrics()}
          disabled={loading}
          className="rounded-lg border border-violet-500/30 px-4 py-2 text-sm text-violet-200 transition hover:bg-violet-500/10 disabled:opacity-50"
        >
          Atualizar
        </button>
      </div>

      <section className="rounded-3xl border border-violet-500/20 bg-slate-950/80 p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
              MYRYRA Intelligence
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              Sua evolução em perspectiva
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Acompanhe suas conclusões ao longo do tempo.
            </p>
          </div>

          <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-slate-900 p-1">
            {([
              ["day", "Dia"],
              ["week", "Semana"],
              ["month", "Mês"],
              ["year", "Ano"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                aria-pressed={period === value}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  period === value
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-900/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!loading && !error && nextTask && (
          <section className="mt-5 rounded-2xl border border-violet-400/30 bg-gradient-to-r from-violet-500/15 via-purple-500/10 to-slate-950/40 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
                  MYRYRA Intelligence 2.3
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  Sua próxima melhor ação
                </h3>
                <p className="mt-3 break-words text-base font-medium text-violet-100">
                  {nextTask.task.title}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {nextTask.reason}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigateToTask?.(nextTask.task.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="shrink-0 rounded-xl border border-violet-400/30 bg-violet-500/20 px-4 py-3 text-sm font-medium text-violet-100 transition hover:bg-violet-500/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
              >
                Ver minhas tarefas →
              </button>
            </div>
          </section>
        )}
        {!loading && !error && rankedTasks.length > 0 && (
          <section className="mt-5 rounded-2xl border border-violet-400/20 bg-slate-950/50 p-5">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
                MYRYRA Intelligence 2.6
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Top 3 próximas ações
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Ranking inteligente baseado em prazo e prioridade.
              </p>
            </div>

            <div className="grid gap-3">
              {rankedTasks.map((item, index) => (
                <article
                  key={item.task.id}
                  className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-sm font-bold text-violet-200">
                      {index + 1}
                    </span>

                    <div className="min-w-0">
                      <p className="break-words font-medium text-white">
                        {item.task.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {item.reason}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                    <div className="text-right">
                      <p className="text-xl font-semibold text-violet-300">
                        {item.score}
                        <span className="text-xs text-slate-500">/100</span>
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        Índice de prioridade
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        navigateToTask?.(item.task.id);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="rounded-lg border border-violet-400/30 bg-violet-500/15 px-3 py-2 text-xs font-medium text-violet-100 transition hover:bg-violet-500/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                    >
                      Abrir tarefa
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        <section className="mt-5 rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.08] via-slate-950/40 to-slate-950/20 p-4 sm:p-5">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
              MYRYRA Intelligence 2.1
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              Insights de produtividade
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Recomendações baseadas nos seus indicadores reais.
            </p>
          </div>

          {loading || !metrics ? (
            <p className="text-sm text-slate-400">
              Analisando seus indicadores...
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {insights.map((insight) => (
                <article
                  key={insight.id}
                  className="rounded-xl border border-violet-400/10 bg-white/[0.025] p-4 transition-colors duration-200 hover:border-violet-400/30 hover:bg-violet-400/[0.05]"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        insight.severity === "positive"
                          ? "bg-emerald-400"
                          : insight.severity === "attention"
                            ? "bg-amber-400"
                            : "bg-violet-400"
                      }`}
                    />
                    <span className="text-xs font-medium text-slate-400">
                      {insight.severity === "positive"
                        ? "Evolução positiva"
                        : insight.severity === "attention"
                          ? "Requer atenção"
                          : "Recomendação"}
                    </span>
                  </div>

                  <h4 className="font-medium text-white">
                    {insight.title}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {insight.description}
                  </p>

                  {["next-action", "pending-work", "overdue-tasks", "priority-overload"].includes(insight.id) && (
                    <button
                      type="button"
                      onClick={() => {
                        navigateTo("vyra-tasks");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-200 transition-all duration-200 hover:border-violet-400/50 hover:bg-violet-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                    >
                      Ver minhas tarefas
                      <span aria-hidden="true">→</span>
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-slate-400">Concluídas no período</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-white">
              {loading || !metrics ? "—" : currentCoverage === "unavailable" ? "—" : periodMetrics.current}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-slate-400">Período anterior</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-200">
              {loading || !metrics ? "—" : previousCoverage === "unavailable" ? "—" : periodMetrics.previous}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-violet-400/15 bg-violet-400/5 px-4 py-3">
          <p className="text-xs leading-relaxed text-violet-200">
            {loading || !metrics
              ? "Analisando histórico de produtividade..."
              : comparisonAvailable
                ? periodMetrics.percentageChange === null
                  ? "Comparação disponível, mas sem base percentual no período anterior."
                  : `Variação de ${periodMetrics.percentageChange > 0 ? "+" : ""}${periodMetrics.percentageChange}% em relação ao período anterior.`
                : "Comparação indisponível: o histórico de um ou ambos os períodos está incompleto."}
          </p>
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
          <div className="mb-4">
            <h4 className="font-medium text-white">Evolução das conclusões</h4>
            <p className="mt-1 text-xs text-slate-400">
              Quantidade de tarefas concluídas em cada período.
            </p>
          </div>

          {!loading && metrics && validCompletionPoints === 1 && (
            <p className="mb-4 rounded-xl border border-violet-400/20 bg-violet-500/5 px-4 py-3 text-xs leading-relaxed text-violet-200">
              A MYRYRA já registrou dados de produtividade neste histórico.
              Ainda não existem períodos suficientes para formar uma curva
              de evolução. Continue concluindo tarefas para acompanhar sua tendência.
            </p>
          )}
          <div className="h-64 w-full">
            {loading || !metrics ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                {loading ? "Carregando evolução..." : "Dados indisponíveis."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={completionSeries}
                  margin={{ top: 10, right: 8, left: -25, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="vyraCompletionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#334155" strokeDasharray="3 5" />
                  <XAxis
                    dataKey="label"
                    stroke="#94a3b8"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, "dataMax"]}
                    tickCount={3}
                    stroke="#94a3b8"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #475569",
                      borderRadius: "12px",
                      color: "#ffffff",
                    }}
                  />
                  <Area
                    type="linear"
                    dataKey="completed"
                    name="Concluídas"
                    stroke="#a78bfa"
                    strokeWidth={3}
                    fill="url(#vyraCompletionGradient)"
                    dot={{
                      r: 5,
                      fill: "#a78bfa",
                      stroke: "#6d28d9",
                      strokeWidth: 2,
                    }}
                    activeDot={{ r: 7, fill: "#a78bfa" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <p className="text-xs text-slate-400" role="status">
            {currentCoverage === "available"
              ? "Histórico disponível"
              : currentCoverage === "partial"
                ? "Histórico parcial — conclusões anteriores à coleta não incluídas"
                : "Sem histórico para este período"}
          </p>
          <p className="text-xs text-slate-400">
            {previousCoverage === "available"
              ? "Histórico disponível"
              : previousCoverage === "partial"
                ? "Histórico parcial — comparação limitada"
                : "Sem histórico para comparação"}
          </p>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Histórico disponível somente para tarefas com data de conclusão registrada.
          Períodos anteriores ao início desse registro podem estar incompletos.
        </p>
      </section>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="rounded-2xl border border-violet-500/20 bg-slate-900 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">Taxa de conclusão</h3>
            <p className="text-sm text-slate-400">
              Percentual de tarefas concluídas no total cadastrado.
            </p>
          </div>
          <span className="text-2xl font-bold text-violet-300">
            {loading || !metrics ? "—" : `${completionRate}%`}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Taxa de conclusão das tarefas"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={metrics ? completionRate : undefined}
          className="h-3 overflow-hidden rounded-full bg-slate-800"
        >
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-500"
            style={{ width: `${metrics ? completionRate : 0}%` }}
          />
        </div>
      </div>
      <div className="rounded-2xl border border-violet-500/20 bg-slate-900 p-5">
        <h3 className="mb-2 text-lg font-semibold text-white">
          Distribuição das tarefas
        </h3>
        <p className="mb-4 text-sm text-slate-400">
          Visualize como suas tarefas estão distribuídas por status.
        </p>

        {!loading && metrics && metrics.total > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={chartColors[index]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-slate-400">
            {loading
              ? "Carregando gráfico..."
              : "Nenhuma tarefa disponível para análise."}
          </p>
        )}
      </div>
      <div className="rounded-2xl border border-violet-500/20 bg-slate-900 p-5">
        <h3 className="mb-2 text-lg font-semibold text-white">
          Tarefas por prioridade
        </h3>
        <p className="mb-4 text-sm text-slate-400">
          Distribuição das tarefas cadastradas por nível de prioridade.
        </p>

        {!loading && metrics && metrics.total > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={priorityChartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis allowDecimals={false} stroke="#94a3b8" />
                <Tooltip
                  cursor={{ fill: "#334155", fillOpacity: 0.25 }}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #475569",
                    borderRadius: "12px",
                    color: "#ffffff",
                  }}
                />
                <Bar
                  dataKey="quantidade"
                  name="Tarefas"
                  fill="#8b5cf6"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={70}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-slate-400">
            {loading
              ? "Carregando gráfico..."
              : "Nenhuma tarefa disponível para análise."}
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-violet-500/20 bg-slate-900 p-5"
          >
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className="mt-3 text-3xl font-bold text-white">
              {loading ? "..." : card.value ?? "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
