import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import CalendarEvents from "./calendar-events";
import CloudPlans from "./cloud-plans";
import CopilotChat from "./copilot-chat";
import DailyCopilot from "./daily-copilot";
import AvailabilityPanel from "./availability-panel";
import { LogoutButton } from "./logout-button";
import PlanningSettings from "./planning-settings";
import GoogleCalendarSettings from "./google-calendar-settings";
import RlsWriteTest from "./rls-write-test";
import SmartSchedulingPanel from "./smart-scheduling-panel";
import TaskKanban from "./task-kanban";
import PerformanceInsights from "./performance-insights";
import VyraHeader from "./vyra-header";
import VyraNavigation from "./vyra-navigation";
import VyraWorkspace from "./vyra-workspace";
import VyraModule from "./vyra-module";
import VyraHome from "./vyra-home";
import VyraSection from "./vyra-section";

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
        eyebrow="MYKA AI"
        title="Sua inteligência pessoal."
        description="Converse com a Myka para organizar prioridades, tomar decisões e planejar sua rotina."
      >
        <CopilotChat />
      </VyraSection>
</VyraModule>
      <VyraModule id="vyra-planner">
<VyraSection
        id="vyra-planner"
        eyebrow="MYRYRA PLANNER"
        title="Seu dia, sob controle."
        description="Transforme suas prioridades em um planejamento claro e objetivo."
      >
        <DailyCopilot />
      </VyraSection>
<section className="rounded-xl border border-slate-800 p-6">
        <h2 className="text-xl font-semibold">
          Meus planos
        </h2>

        <CloudPlans />
      </section>
</VyraModule>
      <VyraModule id="vyra-tasks">
<VyraSection
        id="vyra-tasks"
        eyebrow="MYRYRA TASKS"
        title="Transforme planos em conquistas."
        description="Acompanhe suas tarefas, prioridades e progresso em um único lugar."
      >
        <TaskKanban />
      </VyraSection>
</VyraModule>
      <VyraModule id="vyra-calendar">
<VyraSection
        id="vyra-calendar"
        eyebrow="MYRYRA CALENDAR"
        title="Sua agenda em sintonia."
        description="Organize compromissos e períodos indisponíveis para planejar melhor seu tempo."
      >
        <CalendarEvents />
      </VyraSection>
      <AvailabilityPanel />
      </VyraModule>
      <VyraModule id="vyra-scheduling">
<VyraSection
        id="vyra-scheduling"
        eyebrow="MYRYRA INTELLIGENCE"
        title="Seu tempo, melhor aproveitado."
        description="Descubra os melhores horários para suas tarefas com base nas prioridades, durações e compromissos da sua agenda."
      >
        <SmartSchedulingPanel />
      </VyraSection>
</VyraModule>
      <VyraModule id="vyra-performance">
<VyraSection
        id="vyra-performance"
        eyebrow="MYRYRA PERFORMANCE"
        title="Sua evolução em números."
        description="Acompanhe suas conquistas, identifique oportunidades de melhoria e tome decisões com base em dados reais."
      >
        <PerformanceInsights />
      </VyraSection>
</VyraModule>
      <VyraModule id="vyra-settings">
<VyraSection
        id="vyra-settings"
        eyebrow="MYRYRA SETTINGS"
        title="Uma experiência feita para você."
        description="Configure seus dias, horários e preferências de planejamento."
      >
        <PlanningSettings />
        <div className="mt-6">
          <GoogleCalendarSettings />
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
    <main className="min-h-screen bg-slate-950 p-8 text-white">
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
