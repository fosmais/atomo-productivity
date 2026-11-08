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
import MyryraGuide from "./myryra-guide";
import ThemePreferences from "./theme-preferences";

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

  // Legal onboarding is enforced only after both reviewed documents are published.
  // A missing catalog never implies consent, and no synthetic acceptance is created.
  const { data: legalDocs, error: legalError } = await supabase
    .from("myryra_privacy_document_versions")
    .select("id,document_type,published_at")
    .in("document_type", ["terms", "privacy_notice"])
    .eq("status", "published")
    .lte("effective_at", new Date().toISOString())
    .order("effective_at", { ascending: false });

  if (!legalError && legalDocs) {
    const terms = legalDocs.find(d => d.document_type === "terms" && d.published_at);
    const notice = legalDocs.find(d => d.document_type === "privacy_notice" && d.published_at);
    if (terms && notice) {
      const { data: accepted, error: acceptanceError } = await supabase
        .from("myryra_privacy_acceptances")
        .select("document_version_id,action")
        .in("document_version_id", [terms.id, notice.id]);
      if (acceptanceError || !accepted?.some(a => a.document_version_id === terms.id && a.action === "accepted") ||
          !accepted?.some(a => a.document_version_id === notice.id && a.action === "acknowledged")) {
        redirect("/privacidade/primeiro-acesso");
      }
    }
  }

  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")) {
    redirect("/login");
  }

  return (
    <div
      id="dashboard-top"
      className="mx-auto w-full max-w-[1600px] space-y-6"
    >
      <VyraWorkspace>
      <VyraHome />

        <div className="min-w-0 space-y-6">




      <VyraModule id="vyra-ai">
        <VyraSection
          id="vyra-ai"
          eyebrow="SUA ASSISTENTE"
          title="Converse com a MIKA"
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
          </div>
        </VyraSection>
      </VyraModule>
      <VyraModule id="vyra-tasks">
  <VyraSection
    id="vyra-tasks"
    eyebrow="ORGANIZAÇÃO"
    title="Minhas tarefas e planos"
    description="Organize suas tarefas, planeje seu dia e evolua com a MYKA."
  >
    <TaskPlanningCards
      tasks={<div className="min-w-0 space-y-4">
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          <FeatureAccordion id="goals" title="Metas rápidas" description="Acompanhe pequenas conquistas" userId={user.id}><QuickGoals userId={user.id} /></FeatureAccordion>
          <FeatureAccordion id="plans" title="Meus planos" description="Acompanhe seus planos" userId={user.id}><CloudPlans /></FeatureAccordion>
          <FeatureAccordion id="capture" title="Anotar uma ideia" description="Transforme suas ideias em tarefas" userId={user.id}><QuickCapture /></FeatureAccordion>
        </div>
        <FeatureAccordion id="kanban" title="Minhas tarefas" description="Veja e atualize o que precisa fazer" userId={user.id} defaultOpen><TaskKanban /></FeatureAccordion>
      </div>}
      today={<div id="planner-today" className="min-w-0 scroll-mt-8">
        <MyDay />
      </div>}
      intelligence={<div id="planner-intelligence" className="grid min-w-0 gap-4 scroll-mt-8 lg:grid-cols-2">
        <FeatureAccordion id="daily-copilot" title="Ajuda para planejar" description="Organize seu dia com a MIKA" userId={user.id}><DailyCopilot /></FeatureAccordion>
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
          <div className="min-w-0 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FeatureAccordion id="agenda-reminders" title="Lembretes" description="Veja os próximos avisos" userId={user.id}><DueReminders /></FeatureAccordion>
              <FeatureAccordion id="availability" title="Minha disponibilidade" description="Horários livres e bloqueios" userId={user.id}><AvailabilityPanel /></FeatureAccordion>
            </div>
            <section className="min-w-0 rounded-2xl border border-white/10 bg-slate-900/60 p-3 sm:p-4" aria-label="Calendário e compromissos">
              <CalendarEvents />
            </section>
          </div>
        </VyraSection>
      </VyraModule>
      <VyraModule id="vyra-scheduling">
<VyraSection
        id="vyra-scheduling"
        eyebrow="SUA ASSISTENTE"
        title="Seu tempo, melhor aproveitado."
        description="Descubra os melhores horários para suas tarefas com base nas prioridades, durações e compromissos da sua agenda."
      >
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <FeatureAccordion id="autopilot" title="Organizar meu dia" description="Encontre tempo para suas tarefas" userId={user.id}><AutoPilot /></FeatureAccordion>
        <FeatureAccordion id="scheduling" title="Encontrar um horário" description="Veja sugestões de horários livres" userId={user.id}><SmartSchedulingPanel /></FeatureAccordion>
        </div>
      </VyraSection>
</VyraModule>
      <VyraModule id="vyra-performance">
<VyraSection
        id="vyra-performance"
        eyebrow="SEU PROGRESSO"
        title="Veja seu progresso"
        description="Acompanhe suas conquistas, identifique oportunidades de melhoria e tome decisões com base em dados reais."
      >
        <ProductivityScore />
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <FeatureAccordion id="weekly" title="Resumo da semana" description="Veja como foi sua semana" userId={user.id} defaultOpen><WeeklyIntelligence /></FeatureAccordion>
        <FeatureAccordion id="performance" title="Minha evolução" description="Acompanhe suas conquistas" userId={user.id}><PerformanceInsights /></FeatureAccordion>
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
      <VyraModule id="vyra-guide">
        <VyraSection id="vyra-guide" eyebrow="COMO FUNCIONA" title="Conheça a MYRYRA" description="Descubra as ferramentas e encontre o melhor caminho para começar.">
          <MyryraGuide />
        </VyraSection>
      </VyraModule>
      <VyraModule id="vyra-settings">
<VyraSection
        id="vyra-settings"
        eyebrow="SUA CONTA"
        title="Uma experiência feita para você."
        description="Gerencie sua conta, conecte aplicativos e compartilhe sugestões."
      >
        <SettingsCards
          appearance={<FeatureAccordion id="appearance" title="Aparência" description="Escolha a cor do fundo da MYRYRA" userId={user.id}><ThemePreferences /></FeatureAccordion>}
          security={<FeatureAccordion id="mfa" title="Segurança da conta" description="Senha e autenticação em dois fatores" userId={user.id}><div className="space-y-4"><MfaSettings /><ChangePassword /></div></FeatureAccordion>}
          integrations={<FeatureAccordion id="external-integrations" title="Aplicativos conectados" description="Google Calendar, Google Tasks, Todoist e Outlook" userId={user.id}><div className="min-w-0 space-y-4"><GoogleCalendarSettings /><ExternalIntegrations /></div></FeatureAccordion>}
          data={<div className="space-y-3">
            <FeatureAccordion id="trash" title="Lixeira" description="Recupere tarefas e compromissos excluídos" userId={user.id}><MyryraTrash /></FeatureAccordion>
            <FeatureAccordion id="feedback" title="Enviar sugestão" description="Conte o que podemos melhorar" userId={user.id}><BetaFeedback /></FeatureAccordion>
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
