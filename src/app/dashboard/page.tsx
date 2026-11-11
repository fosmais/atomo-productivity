import SettingsCards from "./settings-cards";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import CalendarEvents from "./calendar-events";
import DueReminders from "./due-reminders";
import CloudPlans from "./cloud-plans";
import CopilotChat from "./copilot-chat";
import DailyCopilot from "./daily-copilot";
import WhatNow from "./what-now";
import FocusMode from "./focus-mode";
import QuickCapture from "./quick-capture";
import DailyBriefing from "./daily-briefing";
import MyDay from "./my-day";
import SmartReplan from "./smart-replan";
import QuickGoals from "./quick-goals";
import BetaFeedback from "./beta-feedback";
import WeeklyIntelligence from "./weekly-intelligence";
import AvailabilityPanel from "./availability-panel";
import { LogoutButton } from "./logout-button";
import PlanningSettings from "./planning-settings";
import MfaSettings from "./mfa-settings";
import ChangePassword from "./change-password";
import GoogleCalendarSettings from "./google-calendar-settings";
import ExternalIntegrations from "./external-integrations";
import SmartSchedulingPanel from "./smart-scheduling-panel";
import AutoPilot from "./auto-pilot";
import TaskKanban from "./task-kanban";
import TaskPlanningCards from "./task-planning-cards";
import MyryraTrash from "./myryra-trash";
import PerformanceInsights from "./performance-insights";
import ProductivityScore from "./productivity-score";
import VyraHeader from "./vyra-header";
import VyraNavigation from "./vyra-navigation";
import VyraWorkspace from "./vyra-workspace";
import VyraModule from "./vyra-module";
import VyraHome from "./vyra-home";
import PlannerQuickNav from "./planner-quick-nav";
import VyraSection from "./vyra-section";
import { FeatureAccordion } from "./feature-accordion";
import MyryraFinanceStarter from "./myryra-finance-starter";
import FinancePlanning from "./finance-planning";
import FinanceInvestments from "./finance-investments";
import FinanceSubscriptions from "./finance-subscriptions";
import FinanceWorkspace from "./finance-workspace";
import HealthWorkspace from "./health-workspace";
import ThemePreferences from "./theme-preferences";
import MikaResolveMyDay from "./mika-resolve-my-day";
import MikaJourneyPlanner from "./mika-journey-planner";

async function DashboardContent() {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")) {
    redirect("/login");
  }

  // Rollout is deliberately opt-in until legal documents are published and tested.
  // This server-side gate covers the dashboard; API mutations require separate enforcement.
  if (process.env.MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true") {
    const now = new Date().toISOString();
    const { data: versions, error: versionsError } = await supabase
      .from("myryra_privacy_document_versions")
      .select("id,document_type")
      .eq("status", "published")
      .lte("published_at", now)
      .lte("effective_at", now)
      .order("effective_at", { ascending: false })
      .order("published_at", { ascending: false })
      .order("id", { ascending: false });
    if (versionsError) redirect("/privacy/accept");
    const current = ["terms", "privacy_notice"].map((type) =>
      (versions ?? []).find((version) => version.document_type === type)?.id,
    );
    if (current.some((id) => !id)) redirect("/privacy/accept");
    const { data: accepted, error: acceptedError } = await supabase
      .from("myryra_privacy_acceptances")
      .select("document_version_id")
      .eq("user_id", user.id)
      .eq("action", "accepted")
      .in("document_version_id", current as string[]);
    if (acceptedError || current.some((id) => !(accepted ?? []).some((entry) => entry.document_version_id === id))) {
      redirect("/privacy/accept");
    }
  }

  return (
    <div
      id="dashboard-top"
      className="mx-auto w-full max-w-[1600px] space-y-6"
    >
      <VyraWorkspace>
      <VyraHome />
      <MikaResolveMyDay />

        <div className="min-w-0 space-y-6">




      <VyraModule id="vyra-ai">
        <VyraSection
          id="vyra-ai"
          eyebrow="MYRYRA INTELLIGENCE"
          title="Converse com a MYKA."
          description="Sua assistente pessoal para transformar ideias em decisões e próximos passos."
        >
          <div className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-950/40 via-slate-900/75 to-slate-950/80 p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-3">
                <img src="/myka-transparente.png" alt="MYKA" className="h-12 w-12 shrink-0 object-contain" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">MYKA · Assistente pessoal</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">Sua próxima ideia começa aqui.</h3>
                </div>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">Converse naturalmente sobre prioridades, compromissos e objetivos. A MYKA ajuda você a organizar o que importa.</p>
            </div>
            <section className="min-w-0 rounded-2xl border border-white/15 bg-slate-900/75 p-3 sm:p-5" aria-label="Conversa com a MYKA">
              <CopilotChat />
            </section>
            <MikaJourneyPlanner />
          </div>
        </VyraSection>
      </VyraModule>
      <VyraModule id="vyra-tasks">
  <VyraSection
    id="vyra-tasks"
    eyebrow="MYRYRA WORKSPACE"
    title="Tarefas e Planejamento"
    description="Organize suas tarefas, planeje seu dia e evolua com a MYKA."
  >
    <TaskPlanningCards
      tasks={<div className="min-w-0 space-y-4">
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          <FeatureAccordion id="goals" title="Metas rápidas" description="Acompanhe pequenas conquistas" userId={user.id}><QuickGoals userId={user.id} /></FeatureAccordion>
          <FeatureAccordion id="plans" title="Meus planos" description="Acompanhe seus planos" userId={user.id}><CloudPlans /></FeatureAccordion>
          <FeatureAccordion id="capture" title="Captura Inteligente" description="Transforme ideias em tarefas" userId={user.id}><QuickCapture /></FeatureAccordion>
        </div>
        <FeatureAccordion id="kanban" title="Quadro de tarefas" description="Visualize e edite tarefas por andamento" userId={user.id} defaultOpen><TaskKanban /></FeatureAccordion>
      </div>}
      today={<div id="planner-today" className="min-w-0 scroll-mt-8">
        <MyDay />
      </div>}
      intelligence={<div id="planner-intelligence" className="grid min-w-0 gap-4 scroll-mt-8 lg:grid-cols-2">
        <FeatureAccordion id="daily-copilot" title="Copiloto diário" description="Planeje com a MYKA" userId={user.id}><DailyCopilot /></FeatureAccordion>
        <FeatureAccordion id="replan" title="Replanejamento" description="Reorganize tarefas atrasadas" userId={user.id}><SmartReplan /></FeatureAccordion>
        <div className="lg:col-span-2"><FeatureAccordion id="planning-settings" title="Preferências de planejamento" description="Horários e regras da rotina" userId={user.id}><PlanningSettings /></FeatureAccordion></div>
      </div>}
      focus={<div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <FeatureAccordion id="planning-focus" title="Modo Foco" description="Concentre-se nas suas prioridades" userId={user.id} defaultOpen><FocusMode /></FeatureAccordion>
        <FeatureAccordion id="planning-performance" title="Evolução e resultados" description="Acompanhe seu progresso" userId={user.id}><PerformanceInsights /></FeatureAccordion>
      </div>}
    />
  </VyraSection>
</VyraModule>
      <VyraModule id="vyra-calendar">
        <VyraSection
          id="vyra-calendar"
          eyebrow="MYRYRA CALENDAR"
          title="Minha agenda"
          description="Seus compromissos, tarefas e horários em um só lugar."
        >
          <div className="min-w-0 space-y-4">
            <DueReminders />
            <CalendarEvents />
            <FeatureAccordion id="availability" title="Horários livres" description="Consulte disponibilidade e períodos ocupados" userId={user.id}>
              <AvailabilityPanel />
            </FeatureAccordion>
          </div>
        </VyraSection>
      </VyraModule>
      <VyraModule id="vyra-scheduling">
<VyraSection
        id="vyra-scheduling"
        eyebrow="MYRYRA INTELLIGENCE"
        title="Seu tempo, melhor aproveitado."
        description="Descubra os melhores horários para suas tarefas com base nas prioridades, durações e compromissos da sua agenda."
      >
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <FeatureAccordion id="autopilot" title="AutoPilot" description="Encontre horários para executar tarefas" userId={user.id}><AutoPilot /></FeatureAccordion>
        <FeatureAccordion id="scheduling" title="Smart Scheduling" description="Sugestões inteligentes para sua agenda" userId={user.id}><SmartSchedulingPanel /></FeatureAccordion>
        </div>
      </VyraSection>
</VyraModule>
      <VyraModule id="vyra-performance">
<VyraSection
        id="vyra-performance"
        eyebrow="MYRYRA PERFORMANCE"
        title="Sua evolução em números."
        description="Acompanhe suas conquistas, identifique oportunidades de melhoria e tome decisões com base em dados reais."
      >
        <ProductivityScore />
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <FeatureAccordion id="weekly" title="Weekly Intelligence" description="Indicadores de sua semana" userId={user.id} defaultOpen><WeeklyIntelligence /></FeatureAccordion>
        <FeatureAccordion id="performance" title="Performance & Insights" description="Explore seus indicadores de produtividade" userId={user.id}><PerformanceInsights /></FeatureAccordion>
        </div>
      </VyraSection>
</VyraModule>
      <VyraModule id="vyra-finance">
        <VyraSection id="vyra-finance" eyebrow="MYRYRA FINANCE" title="Seu dinheiro, com mais clareza." description="Organize receitas e despesas sem precisar conectar um banco.">
          <FinanceWorkspace />
        </VyraSection>
      </VyraModule>
      <VyraModule id="vyra-health">
        <VyraSection id="vyra-health" eyebrow="MYRYRA SAÚDE" title="Bem-estar com a MIKA." description="Comece com seus objetivos e preferências para construir uma rotina saudável.">
          <HealthWorkspace />
        </VyraSection>
      </VyraModule>
      <VyraModule id="vyra-settings">
<VyraSection
        id="vyra-settings"
        eyebrow="MYRYRA SETTINGS"
        title="Uma experiência feita para você."
        description="Gerencie sua conta, conecte aplicativos e compartilhe sugestões."
      >
        <SettingsCards
          appearance={<FeatureAccordion id="appearance" title="Aparência" description="Escolha a cor do fundo da MYRYRA" userId={user.id}><ThemePreferences /></FeatureAccordion>}
          security={<FeatureAccordion id="mfa" title="Segurança da conta" description="Senha e autenticação em dois fatores" userId={user.id}><div className="space-y-4"><MfaSettings /><ChangePassword /></div></FeatureAccordion>}
          integrations={<FeatureAccordion id="external-integrations" title="Aplicativos conectados" description="Google Calendar, Google Tasks, Todoist e Outlook" userId={user.id}><div className="min-w-0 space-y-4"><GoogleCalendarSettings /><ExternalIntegrations /></div></FeatureAccordion>}
          data={<div className="space-y-3">
            <FeatureAccordion id="trash" title="Lixeira" description="Recupere tarefas e compromissos excluídos" userId={user.id}><MyryraTrash /></FeatureAccordion>
            <FeatureAccordion id="feedback" title="Feedback" description="Sugestões e relatos sobre a plataforma" userId={user.id}><BetaFeedback /></FeatureAccordion>
          </div>}
          footer={<div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 break-all text-sm text-slate-400">Conta: {user.email}</p>
            <LogoutButton />
          </div>}
        />
      </VyraSection>
      </VyraModule>





        </div>
      </VyraWorkspace>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen min-w-0 bg-slate-950 px-3 py-4 text-white sm:px-5 sm:py-6 lg:p-8">
      <Suspense
        fallback={
          <div className="mx-auto max-w-4xl text-slate-300">
            Carregando seu painel...
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </main>
  );
}
