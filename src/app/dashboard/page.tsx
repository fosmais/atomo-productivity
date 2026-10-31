import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import CalendarEvents from "./calendar-events";
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
import FirstSteps from "./first-steps";
import WeeklyIntelligence from "./weekly-intelligence";
import AvailabilityPanel from "./availability-panel";
import { LogoutButton } from "./logout-button";
import PlanningSettings from "./planning-settings";
import MfaSettings from "./mfa-settings";
import FavoritesPanel from "./favorites-panel";
import GoogleCalendarSettings from "./google-calendar-settings";
import SmartSchedulingPanel from "./smart-scheduling-panel";
import AutoPilot from "./auto-pilot";
import TaskKanban from "./task-kanban";
import PerformanceInsights from "./performance-insights";
import VyraHeader from "./vyra-header";
import VyraNavigation from "./vyra-navigation";
import VyraWorkspace from "./vyra-workspace";
import VyraModule from "./vyra-module";
import VyraHome from "./vyra-home";
import VyraSection from "./vyra-section";
import { FeatureAccordion, AccordionControls } from "./feature-accordion";

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

  return (
    <div
      id="dashboard-top"
      className="mx-auto w-full max-w-[1600px] space-y-6"
    >
      <VyraWorkspace>
      <VyraHome />
      <FirstSteps userId={user.id} />

        <div className="min-w-0 space-y-6">\n          <AccordionControls />



      <VyraModule id="vyra-ai">
<VyraSection
        id="vyra-ai"
        eyebrow="MYKA AI"
        title="Sua inteligência pessoal."
        description="Converse com a Myka para organizar prioridades, tomar decisões e planejar sua rotina."
      >
        <FeatureAccordion id="myka" title="Converse com a MYKA" description="Sua assistente inteligente" userId={user.id} defaultOpen><CopilotChat /></FeatureAccordion>
      </VyraSection>
</VyraModule>
      <VyraModule id="vyra-planner">
<VyraSection
        id="vyra-planner"
        eyebrow="MYRYRA PLANNER"
        title="Seu dia, sob controle."
        description="Transforme suas prioridades em um planejamento claro e objetivo."
      >
        <FeatureAccordion id="day" title="Meu Dia" description="Prioridades e compromissos de hoje" userId={user.id} defaultOpen><MyDay /></FeatureAccordion>
        <FeatureAccordion id="replan" title="Replanejamento" description="Atualize tarefas atrasadas com controle" userId={user.id}><SmartReplan /></FeatureAccordion>
        <FeatureAccordion id="goals" title="Metas rápidas" description="Acompanhe suas pequenas conquistas" userId={user.id}><QuickGoals userId={user.id} /></FeatureAccordion>
        <FeatureAccordion id="briefing" title="Daily Briefing" description="Resumo para começar o dia" userId={user.id}><DailyBriefing /></FeatureAccordion>
        <FeatureAccordion id="what-now" title="What Now?" description="Sua próxima ação recomendada" userId={user.id}><WhatNow /></FeatureAccordion>
        <FeatureAccordion id="focus" title="Focus Mode" description="Sessões para manter a concentração" userId={user.id}><FocusMode /></FeatureAccordion>
        <FeatureAccordion id="daily-copilot" title="Copiloto diário" description="Planejamento com inteligência artificial" userId={user.id}><DailyCopilot /></FeatureAccordion>
      </VyraSection>
<section className="rounded-xl border border-slate-800 p-6">
        <h2 className="text-xl font-semibold">
          Meus planos
        </h2>

        <FeatureAccordion id="plans" title="Meus planos" description="Acompanhe seus planos e tarefas" userId={user.id}><CloudPlans /></FeatureAccordion>
      </section>
</VyraModule>
      <VyraModule id="vyra-tasks">
<VyraSection
        id="vyra-tasks"
        eyebrow="MYRYRA TASKS"
        title="Transforme planos em conquistas."
        description="Acompanhe suas tarefas, prioridades e progresso em um único lugar."
      >
        <FeatureAccordion id="favorites" title="Favoritos" description="Acesse rapidamente o que importa" userId={user.id}><FavoritesPanel /></FeatureAccordion>
        <FeatureAccordion id="capture" title="Captura Inteligente" description="Transforme ideias em tarefas" userId={user.id}><QuickCapture /></FeatureAccordion>
        <FeatureAccordion id="kanban" title="Quadro de tarefas" description="Organize suas tarefas por andamento" userId={user.id} defaultOpen><TaskKanban /></FeatureAccordion>
      </VyraSection>
</VyraModule>
      <VyraModule id="vyra-calendar">
<VyraSection
        id="vyra-calendar"
        eyebrow="MYRYRA CALENDAR"
        title="Sua agenda em sintonia."
        description="Organize compromissos e períodos indisponíveis para planejar melhor seu tempo."
      >
        <FeatureAccordion id="calendar-events" title="Eventos da agenda" description="Crie e acompanhe compromissos" userId={user.id} defaultOpen><CalendarEvents /></FeatureAccordion>
      </VyraSection>
      <FeatureAccordion id="availability" title="Disponibilidade" description="Visualize os períodos livres e ocupados" userId={user.id}><AvailabilityPanel /></FeatureAccordion>
      </VyraModule>
      <VyraModule id="vyra-scheduling">
<VyraSection
        id="vyra-scheduling"
        eyebrow="MYRYRA INTELLIGENCE"
        title="Seu tempo, melhor aproveitado."
        description="Descubra os melhores horários para suas tarefas com base nas prioridades, durações e compromissos da sua agenda."
      >
        <FeatureAccordion id="autopilot" title="AutoPilot" description="Encontre horários para executar tarefas" userId={user.id}><AutoPilot /></FeatureAccordion>
        <FeatureAccordion id="scheduling" title="Smart Scheduling" description="Sugestões inteligentes para sua agenda" userId={user.id}><SmartSchedulingPanel /></FeatureAccordion>
      </VyraSection>
</VyraModule>
      <VyraModule id="vyra-performance">
<VyraSection
        id="vyra-performance"
        eyebrow="MYRYRA PERFORMANCE"
        title="Sua evolução em números."
        description="Acompanhe suas conquistas, identifique oportunidades de melhoria e tome decisões com base em dados reais."
      >
        <FeatureAccordion id="weekly" title="Weekly Intelligence" description="Indicadores de sua semana" userId={user.id} defaultOpen><WeeklyIntelligence /></FeatureAccordion>
        <FeatureAccordion id="performance" title="Performance & Insights" description="Explore seus indicadores de produtividade" userId={user.id}><PerformanceInsights /></FeatureAccordion>
      </VyraSection>
</VyraModule>
      <VyraModule id="vyra-settings">
<VyraSection
        id="vyra-settings"
        eyebrow="MYRYRA SETTINGS"
        title="Uma experiência feita para você."
        description="Configure seus dias, horários e preferências de planejamento."
      >
        <FeatureAccordion id="feedback" title="Feedback" description="Envie sugestões e relatos sobre o beta" userId={user.id}><BetaFeedback /></FeatureAccordion>
        <FeatureAccordion id="mfa" title="Segurança da conta" description="Configure a autenticação em dois fatores" userId={user.id}><MfaSettings /></FeatureAccordion>
        <FeatureAccordion id="planning-settings" title="Preferências de planejamento" description="Personalize sua rotina" userId={user.id}><PlanningSettings /></FeatureAccordion>
        <div className="mt-6">
          <FeatureAccordion id="google-settings" title="Integração Google Calendar" description="Gerencie a conexão com sua agenda Google" userId={user.id}><GoogleCalendarSettings /></FeatureAccordion>
        </div>
      </VyraSection>

      <div className="mt-6 space-y-4 rounded-2xl border border-slate-800 p-5">
<p className="text-slate-300">
        Conta autenticada: {user.email}
      </p>
        <LogoutButton />
      </div>
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
