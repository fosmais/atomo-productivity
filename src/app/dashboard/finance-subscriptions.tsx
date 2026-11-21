"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useVyraNavigation } from "./vyra-module-context";

type FinanceNotification = { id: string; alert_key: string; title: string; body: string; due_date: string | null; read_at: string | null; created_at: string };
type ExpectedIncome = { id: string; title: string; amount_cents: number; due_date: string };
type PlannedExpense = { id: string; title: string; amount_cents: number; due_date: string };
type FinanceEntry = { amount_cents: number; kind: string };
type Subscription = { id: string; title: string; amount_cents: number; billing_cycle: "monthly" | "yearly"; next_due_date: string };
const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
function parseMoney(value: string) {
  const input = value.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  let normalized = "";
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(input)) normalized = input.replace(/\./g, "").replace(",", ".");
  else if (/^\d+(?:[.,]\d{1,2})?$/.test(input)) normalized = input.replace(",", ".");
  else return null;
  const [whole, decimal = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100000000000 ? cents : null;
}
export default function FinanceSubscriptions() {
  const { navigateTo } = useVyraNavigation();
  const [handoffError, setHandoffError] = useState(false);
  const [items, setItems] = useState<Subscription[]>([]);
  const [planned, setPlanned] = useState<PlannedExpense[]>([]);
  const [expectedIncome, setExpectedIncome] = useState<ExpectedIncome[]>([]);
  const [incomeTitle, setIncomeTitle] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDue, setIncomeDue] = useState("");
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [opening, setOpening] = useState(0);
  const [horizon, setHorizon] = useState(6);
  const [subscriptionSavings, setSubscriptionSavings] = useState(0);
  const [expenseSavings, setExpenseSavings] = useState(0);
  const [scenarioExpenseIds, setScenarioExpenseIds] = useState<string[]>([]);
  const [deferredExpenses, setDeferredExpenses] = useState<Record<string,number>>({});
  const [scenarioSubscriptionIds, setScenarioSubscriptionIds] = useState<string[]>([]);
  const [excludedExpenseIds, setExcludedExpenseIds] = useState<string[]>([]);
  const [asOf, setAsOf] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [due, setDue] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [alertUserId, setAlertUserId] = useState("");
  const [alertDays, setAlertDays] = useState<3 | 7 | 14>(7);
  const [alertSubscriptions, setAlertSubscriptions] = useState(true);
  const [alertExpenses, setAlertExpenses] = useState(true);
  const [alertSettingsOpen, setAlertSettingsOpen] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(false);
  const [alertSettingsError, setAlertSettingsError] = useState("");
  const [notifications, setNotifications] = useState<FinanceNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const lastAutoSyncKey = useRef("");
  const monthlyCents = useMemo(() => items.reduce((sum, item) => sum + (item.billing_cycle === "monthly" ? Number(item.amount_cents) : Number(item.amount_cents) / 12), 0), [items]);
  useEffect(() => {
    let active = true;
    const now = new Date();
    const initialDate = [now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
    queueMicrotask(() => { if (active) setAsOf(initialDate); });
    (async () => {
      try {
        const db = createClient();
        const { data: auth, error: authError } = await db.auth.getUser();
        if (authError || !auth.user) throw new Error("Sessão inválida");
        if (active) setAlertUserId(auth.user.id);
        const { data: savedAlerts, error: savedAlertsError } = await db.from("myryra_finance_alert_preferences")
          .select("days,subscriptions,expenses,email_enabled,push_enabled,daily_digest_enabled").eq("user_id", auth.user.id).maybeSingle();
        if (active) {
          if (savedAlertsError) setAlertSettingsError("Não foi possível carregar as preferências de alertas.");
          else if (savedAlerts) {
            if ([3, 7, 14].includes(savedAlerts.days)) setAlertDays(savedAlerts.days as 3 | 7 | 14);
            setAlertSubscriptions(savedAlerts.subscriptions);
            setAlertExpenses(savedAlerts.expenses);
            setEmailEnabled(savedAlerts.email_enabled);
            setPushEnabled(savedAlerts.push_enabled);
            setDailyDigestEnabled(savedAlerts.daily_digest_enabled);
          }
        }
        const { data: previousNotifications, error: notificationsLoadError } = await db.from("myryra_finance_notifications")
          .select("id,alert_key,title,body,due_date,read_at,created_at")
          .eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(30);
        if (active) {
          if (notificationsLoadError) setNotificationsError("Histórico de notificações indisponível.");
          else setNotifications((previousNotifications ?? []) as FinanceNotification[]);
        }
        const { data, error: queryError } = await db.from("myryra_finance_subscriptions").select("id,title,amount_cents,billing_cycle,next_due_date").eq("user_id", auth.user.id).order("next_due_date", { ascending: true }).limit(200);
        if (queryError) throw queryError;
        const [future, history, balance, income] = await Promise.all([
          db.from("myryra_finance_planned_expenses").select("id,title,amount_cents,due_date").eq("user_id",auth.user.id).limit(1000),
          db.from("myryra_finance_entries").select("amount_cents,kind").eq("user_id",auth.user.id).limit(1000),
          db.from("myryra_finance_balances").select("opening_balance_cents").eq("user_id",auth.user.id).maybeSingle(),
          db.from("myryra_finance_expected_income").select("id,title,amount_cents,due_date").eq("user_id",auth.user.id).limit(1000)
        ]);
        if(future.error || history.error || balance.error || income.error) throw new Error("Falha na projeção");
        if (active) {
          setItems((data ?? []) as Subscription[]);
          setPlanned((future.data ?? []) as PlannedExpense[]);
          setExpectedIncome((income.data ?? []) as ExpectedIncome[]);
          setEntries((history.data ?? []) as FinanceEntry[]);
          setOpening(Number(balance.data?.opening_balance_cents ?? 0));
        }
      } catch { if (active) setError("Não foi possível carregar suas assinaturas."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  const saveAlertSettings = async (days: 3 | 7 | 14, subscriptions: boolean, expenses: boolean) => {
    if (!alertUserId) { setAlertSettingsError("Faça login para salvar suas preferências."); return; }
    setAlertSettingsError("");
    try {
      const db = createClient();
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || auth.user?.id !== alertUserId) throw new Error("Sessão inválida.");
      const { error: saveError } = await db.from("myryra_finance_alert_preferences").upsert({
        user_id: alertUserId, days, subscriptions, expenses, updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (saveError) throw saveError;
      setAlertDays(days);
      setAlertSubscriptions(subscriptions);
      setAlertExpenses(expenses);
    } catch {
      setAlertSettingsError("Não foi possível sincronizar as preferências. Tente novamente.");
    }
  };
  const saveChannelPreference = async (channel: "email_enabled" | "push_enabled" | "daily_digest_enabled", enabled: boolean) => {
    if (!alertUserId) { setAlertSettingsError("Faça login para salvar suas preferências."); return; }
    setAlertSettingsError("");
    try {
      const db = createClient();
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || auth.user?.id !== alertUserId) throw new Error("Sessão inválida");
      const { error: saveError } = await db.from("myryra_finance_alert_preferences").upsert({
        user_id: alertUserId, days: alertDays, subscriptions: alertSubscriptions, expenses: alertExpenses,
        email_enabled: channel === "email_enabled" ? enabled : emailEnabled,
        push_enabled: channel === "push_enabled" ? enabled : pushEnabled,
        daily_digest_enabled: channel === "daily_digest_enabled" ? enabled : dailyDigestEnabled,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (saveError) throw saveError;
      if (channel === "email_enabled") setEmailEnabled(enabled);
      if (channel === "push_enabled") setPushEnabled(enabled);
      if (channel === "daily_digest_enabled") setDailyDigestEnabled(enabled);
    } catch { setAlertSettingsError("Não foi possível salvar a preferência do canal."); }
  };
  const upcomingAlerts = useMemo(() => {
    if (!asOf) return [];
    const start = Date.parse(asOf + "T12:00:00Z");
    if (!Number.isFinite(start)) return [];
    const alerts = [
      ...(alertSubscriptions ? items : []).map(item => ({ id: "sub-" + item.id, title: item.title, amount: Number(item.amount_cents), due: item.next_due_date, type: "Assinatura" })),
      ...(alertExpenses ? planned : []).map(item => ({ id: "exp-" + item.id, title: item.title, amount: Number(item.amount_cents), due: item.due_date, type: "Despesa planejada" }))
    ];
    return alerts.filter(item => {
      const days = (Date.parse(item.due + "T12:00:00Z") - start) / 86400000;
      return Number.isFinite(days) && days >= 0 && days <= alertDays;
    }).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
  }, [asOf, items, planned, alertDays, alertSubscriptions, alertExpenses]);
  const syncNotifications = async () => {
    if (!alertUserId || upcomingAlerts.length === 0) return;
    setNotificationsError("");
    try {
      const db = createClient();
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || auth.user?.id !== alertUserId) throw new Error("Sessão inválida");
      const payload = upcomingAlerts.map(item => ({
        user_id: alertUserId, alert_key: item.id + ":" + item.due,
        title: "Vencimento próximo: " + item.title.slice(0, 150),
        body: item.type + " em " + item.due.slice(8, 10) + "/" + item.due.slice(5, 7) + ". Valor informado: " + brl(item.amount) + ".",
        due_date: item.due
      }));
      const { error: insertError } = await db.from("myryra_finance_notifications").upsert(payload, { onConflict: "user_id,alert_key", ignoreDuplicates: true });
      if (insertError) throw insertError;
      const { data, error: readError } = await db.from("myryra_finance_notifications")
        .select("id,alert_key,title,body,due_date,read_at,created_at")
        .eq("user_id", alertUserId).order("created_at", { ascending: false }).limit(30);
      if (readError) throw readError;
      setNotifications((data ?? []) as FinanceNotification[]);
    } catch { setNotificationsError("Não foi possível atualizar as notificações."); }
  };
  useEffect(() => {
    if (loading || error || !alertUserId || !asOf) return;
    const key = JSON.stringify({ user: alertUserId, date: asOf, days: alertDays, subscriptions: alertSubscriptions, expenses: alertExpenses, alerts: upcomingAlerts.map(item => item.id + ":" + item.due) });
    if (lastAutoSyncKey.current === key) return;
    lastAutoSyncKey.current = key;
    let active = true;
    if (upcomingAlerts.length > 0) {
      queueMicrotask(() => { if (active) void syncNotifications(); });
    }
    return () => { active = false; };
  }, [loading, error, alertUserId, asOf, alertDays, alertSubscriptions, alertExpenses, upcomingAlerts]);
  const markNotificationRead = async (id: string) => {
    if (!alertUserId) return;
    try {
      const db = createClient();
      const { data: auth } = await db.auth.getUser();
      if (auth.user?.id !== alertUserId) throw new Error("Sessão inválida");
      const readAt = new Date().toISOString();
      const { data, error: updateError } = await db.from("myryra_finance_notifications")
        .update({ read_at: readAt }).eq("id", id).eq("user_id", alertUserId).select("id");
      if (updateError || !data?.length) throw new Error("Falha ao atualizar");
      setNotifications(previous => previous.map(item => item.id === id ? { ...item, read_at: readAt } : item));
    } catch { setNotificationsError("Não foi possível marcar a notificação como lida."); }
  };
  const potentialDuplicates = useMemo(() => {
    const normalize = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-z0-9]/g,"");
    return planned.filter(expense => items.some(sub => {
      const name = normalize(expense.title);
      return name.length > 2 && name === normalize(sub.title) && Number(expense.amount_cents) === Number(sub.amount_cents) &&
        expense.due_date.slice(0,7) >= sub.next_due_date.slice(0,7);
    }));
  },[planned,items]);
  const projection = useMemo(() => {
    if(!asOf) return [];
    const [year,month] = asOf.split("-").map(Number);
    let position = opening + entries.reduce((sum,item)=>sum+(item.kind==="income"?1:-1)*Number(item.amount_cents),0);
    return Array.from({length:horizon},(_,offset)=>{
      const current = new Date(Date.UTC(year,month-1+offset,1));
      const period = current.toISOString().slice(0,7);
      const expenses = planned.filter(item=>item.due_date.startsWith(period)&&item.due_date>=asOf&&!excludedExpenseIds.includes(item.id)).reduce((sum,item)=>sum+Number(item.amount_cents),0);
      let subscriptionsDue=0;
      for(const item of items){
        const first=new Date(item.next_due_date+"T12:00:00Z");
        if(Number.isNaN(first.getTime()))continue;
        const billingMonth=first.getUTCFullYear()*12+first.getUTCMonth();
        const currentMonth=current.getUTCFullYear()*12+current.getUTCMonth();
        const distance=currentMonth-billingMonth;
        const interval=item.billing_cycle==="yearly"?12:1;
        if(distance>=0 && distance%interval===0 && (distance>0 || item.next_due_date>=asOf)) subscriptionsDue+=Number(item.amount_cents);
      }
      const incoming = expectedIncome.filter(item=>item.due_date.startsWith(period)&&item.due_date>=asOf).reduce((sum,item)=>sum+Number(item.amount_cents),0);
      position+=incoming-expenses-subscriptionsDue;
      return {period,expenses,subscriptionsDue,incoming,position};
    });
  },[asOf,opening,entries,planned,items,horizon,excludedExpenseIds,expectedIncome]);
  const firstNegative = projection.find(row=>row.position<0);
  const scenario = useMemo(() => {
    let cumulativeSavings = 0;
    return projection.map(row => {
      const selectiveExpenses = planned.filter(item => scenarioExpenseIds.includes(item.id) && !excludedExpenseIds.includes(item.id) && item.due_date >= asOf && item.due_date.startsWith(row.period)).reduce((sum,item)=>sum+Number(item.amount_cents),0);
      const selectedSubscriptions = items.filter(item=>scenarioSubscriptionIds.includes(item.id)).reduce((sum,item)=>{
        const first=new Date(item.next_due_date+"T12:00:00Z");
        const current=new Date(row.period+"-01T12:00:00Z");
        if(Number.isNaN(first.getTime())) return sum;
        const distance=(current.getUTCFullYear()-first.getUTCFullYear())*12+current.getUTCMonth()-first.getUTCMonth();
        const interval=item.billing_cycle==="yearly"?12:1;
        return sum+(distance>=0&&distance%interval===0&&(distance>0||item.next_due_date>=asOf)?Number(item.amount_cents):0);
      },0);
      const deferredOut = planned.filter(item=>!excludedExpenseIds.includes(item.id)&&!scenarioExpenseIds.includes(item.id)&&(deferredExpenses[item.id]??0)>0&&item.due_date>=asOf&&item.due_date.startsWith(row.period)).reduce((sum,item)=>sum+Number(item.amount_cents),0);
      const deferredIn = planned.filter(item=>!excludedExpenseIds.includes(item.id)&&!scenarioExpenseIds.includes(item.id)&&(deferredExpenses[item.id]??0)>0&&item.due_date>=asOf).reduce((sum,item)=>{
        const [y,m]=item.due_date.split("-").map(Number);
        const shifted=new Date(Date.UTC(y,m-1+deferredExpenses[item.id],1)).toISOString().slice(0,7);
        return sum+(shifted===row.period?Number(item.amount_cents):0);
      },0);
      const remainingExpenses=Math.max(0,row.expenses-selectiveExpenses-deferredOut+deferredIn);
      const remainingSubscriptions=Math.max(0,row.subscriptionsDue-selectedSubscriptions);
      const savings=selectiveExpenses+selectedSubscriptions+deferredOut-deferredIn+Math.round(remainingExpenses*expenseSavings/100)+Math.round(remainingSubscriptions*subscriptionSavings/100);
      cumulativeSavings+=savings;
      return {...row,savings,scenarioPosition:row.position+cumulativeSavings};
    });
  },[projection,planned,items,scenarioExpenseIds,scenarioSubscriptionIds,excludedExpenseIds,deferredExpenses,asOf,expenseSavings,subscriptionSavings]);
  const scenarioNegative = scenario.find(row=>row.scenarioPosition<0);
  const totalScenarioSavings = scenario.reduce((sum,row)=>sum+row.savings,0);

  function askMyka() {
    if (!projection.length) return;
    const final = projection[projection.length - 1];
    const warning = firstNegative ? "Há risco de saldo negativo em "+firstNegative.period+"." : "Não há saldo negativo no período simulado.";
    const prompt = [
      "MYKA, ajude-me a revisar meu planejamento financeiro pessoal, com orientações educativas.",
      "Horizonte: "+horizon+" meses. Saldo final estimado: "+brl(final.position)+".",
      warning,
      "Total de receitas futuras previstas: "+brl(projection.reduce((sum,row)=>sum+row.incoming,0))+".",
      "Total de despesas futuras previstas: "+brl(projection.reduce((sum,row)=>sum+row.expenses,0))+".",
      "Total de assinaturas futuras: "+brl(projection.reduce((sum,row)=>sum+row.subscriptionsDue,0))+".",
      "Possíveis despesas duplicadas identificadas: "+potentialDuplicates.length+".",
      "Cenário hipotético: "+Object.values(deferredExpenses).filter(months=>months>0).length+" despesas adiadas, "+scenarioExpenseIds.length+" despesas removidas e "+scenarioSubscriptionIds.length+" assinaturas canceladas apenas na simulação. Redução adicional de "+subscriptionSavings+"% em assinaturas e "+expenseSavings+"% em despesas planejadas. Economia total estimada "+brl(totalScenarioSavings)+". Saldo final simulado "+brl(scenario.length?scenario[scenario.length-1].scenarioPosition:0)+".",
      "Faça uma pergunta por vez para entender prioridades, despesas essenciais e oportunidades de economia.",
      "Não altere registros nem assuma que o saldo é bancário. Não recomende investimentos ou crédito específicos."
    ].join(" ");
    try {
      sessionStorage.setItem("myryra:myka:investment-handoff",prompt);
      setHandoffError(false);
      navigateTo("vyra-ai");
    } catch { setHandoffError(true); }
  }
  async function addIncome(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents=parseMoney(incomeAmount);
    if(!incomeTitle.trim()||incomeTitle.trim().length>100||!cents||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(incomeDue)){setError("Informe os dados da receita prevista.");return;}
    setBusy(true);setError("");
    try {
      const db=createClient();
      const {data:auth,error:authError}=await db.auth.getUser();
      if(authError||!auth.user)throw new Error("Sessão inválida");
      const {data,error:insertError}=await db.from("myryra_finance_expected_income").insert({user_id:auth.user.id,title:incomeTitle.trim(),amount_cents:cents,due_date:incomeDue}).select("id,title,amount_cents,due_date").single();
      if(insertError)throw insertError;
      setExpectedIncome(old=>[...old,data as ExpectedIncome]);setIncomeTitle("");setIncomeAmount("");setIncomeDue("");
    } catch {setError("Não foi possível salvar a receita prevista.");}
    finally {setBusy(false);}
  }
  async function removeIncome(id:string) {
    setError("");
    try {
      const db=createClient();
      const {data:auth,error:authError}=await db.auth.getUser();
      if(authError||!auth.user)throw new Error("Sessão inválida");
      const {error:deleteError}=await db.from("myryra_finance_expected_income").delete().eq("id",id).eq("user_id",auth.user.id);
      if(deleteError)throw deleteError;
      setExpectedIncome(old=>old.filter(item=>item.id!==id));
    } catch {setError("Não foi possível excluir a receita prevista.");}
  }
  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseMoney(amount);
    if (!title.trim() || title.trim().length > 100 || !cents || !/^\d{4}-\d{2}-\d{2}$/.test(due) || Number.isNaN(Date.parse(due + "T12:00:00"))) {
      setError("Informe descrição, valor e data válidos."); return;
    }
    setBusy(true); setError("");
    try {
      const db = createClient();
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) throw new Error("Sessão inválida");
      const { data, error: insertError } = await db.from("myryra_finance_subscriptions").insert({ user_id: auth.user.id, title: title.trim(), amount_cents: cents, billing_cycle: cycle, next_due_date: due }).select("id,title,amount_cents,billing_cycle,next_due_date").single();
      if (insertError) throw insertError;
      setItems(previous => [...previous, data as Subscription].sort((a, b) => a.next_due_date.localeCompare(b.next_due_date)));
      setTitle(""); setAmount(""); setDue("");
    } catch { setError("Não foi possível salvar a assinatura."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setError("");
    try {
      const db = createClient();
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) throw new Error("Sessão expirada.");
      const { data: deleted, error: deleteError } = await db.from("myryra_finance_subscriptions").delete().eq("id", id).eq("user_id", auth.user.id).select("id");
      if (deleteError) throw deleteError;
      if (!deleted?.length) throw new Error("Registro não encontrado.");
      setItems(previous => previous.filter(item => item.id !== id));
    } catch { setError("Não foi possível excluir a assinatura."); }
  }
  return <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-4 sm:p-5">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-violet-300">MYRYRA FINANCE</p><h3 className="mt-1 text-lg font-semibold text-white">Assinaturas recorrentes</h3><p className="mt-1 text-sm text-slate-400">Controle serviços e compromissos recorrentes. Os vencimentos são informativos; não há cobrança ou pagamento automático.</p></div>
    {!loading && !error && (
      <div className="rounded-xl border border-white/15 bg-slate-950/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-sm font-semibold text-white">Central de notificações da MIKA</p><p className="text-xs text-slate-400">{notifications.filter(item => !item.read_at).length} não lidas · histórico financeiro na sua conta</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => void syncNotifications()} className="rounded-lg border border-violet-400/40 px-3 py-2 text-xs text-violet-100">Atualizar avisos</button><button type="button" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(value => !value)} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-200">{notificationsOpen ? "Fechar" : "Ver histórico"}</button></div>
        </div>
        {notificationsOpen && <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">{notifications.length === 0 ? <li className="text-xs text-slate-400">Nenhuma notificação registrada. Use “Atualizar avisos” para registrar vencimentos próximos.</li> : notifications.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-3"><div className="min-w-0"><p className="text-xs font-semibold text-white">{item.title}</p><p className="mt-1 text-xs text-slate-300">{item.body}</p><p className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString("pt-BR")} · {item.read_at ? "Lida" : "Não lida"}</p></div>{!item.read_at && <button type="button" onClick={() => void markNotificationRead(item.id)} className="rounded-lg border border-violet-400/40 px-3 py-2 text-xs text-violet-100">Marcar como lida</button>}</li>)}</ul>}
        {notificationsError && <p role="alert" className="mt-2 text-xs text-rose-300">{notificationsError}</p>}
      </div>
    )}
    {!loading && !error && (
      <div className="flex justify-end"><button type="button" aria-expanded={alertSettingsOpen} onClick={() => setAlertSettingsOpen(value => !value)} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-200 hover:border-violet-400/50">Preferências de alertas</button></div>
    )}
    {!loading && !error && alertSettingsOpen && (
      <div className="grid gap-3 rounded-xl border border-violet-400/20 bg-slate-950/50 p-3 sm:grid-cols-3">
        <label className="text-xs text-slate-200">Antecedência<select aria-label="Antecedência dos alertas" value={alertDays} onChange={e => saveAlertSettings(Number(e.target.value) as 3 | 7 | 14, alertSubscriptions, alertExpenses)} className="mt-1 block w-full rounded-lg border border-white/20 bg-slate-900 p-2 text-white"><option value={3}>3 dias</option><option value={7}>7 dias</option><option value={14}>14 dias</option></select></label>
        <label className="flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={alertSubscriptions} onChange={e => saveAlertSettings(alertDays, e.target.checked, alertExpenses)}/> Assinaturas</label>
        <label className="flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={alertExpenses} onChange={e => saveAlertSettings(alertDays, alertSubscriptions, e.target.checked)}/> Despesas planejadas</label>
        <div className="border-t border-white/10 pt-3 sm:col-span-3"><p className="text-sm font-semibold text-white">Canais de notificações (preparação)</p><p className="mt-1 text-xs text-slate-400">Os canais externos ainda não enviam mensagens. Estas escolhas ficam registradas para uma ativação futura após testes.</p></div>
        <label className="flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={emailEnabled} onChange={e => void saveChannelPreference("email_enabled", e.target.checked)}/> Autorizar e-mail futuramente</label>
        <label className="flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={pushEnabled} onChange={e => void saveChannelPreference("push_enabled", e.target.checked)}/> Autorizar push futuramente</label>
        <label className="flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={dailyDigestEnabled} onChange={e => void saveChannelPreference("daily_digest_enabled", e.target.checked)}/> Resumo diário futuramente</label>
        <p className="text-xs text-slate-400 sm:col-span-3">Preferências sincronizadas com sua conta. Nenhum canal externo está ativo.</p>
      </div>
    )}
    {alertSettingsError && <p role="alert" className="text-xs text-rose-300">{alertSettingsError}</p>}
    {!loading && !error && upcomingAlerts.length > 0 && (
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 sm:p-4" role="status">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-sm font-semibold text-amber-100">MIKA · Próximos vencimentos</p><p className="text-xs text-slate-300">Compromissos informados por você para os próximos {alertDays} dias.</p></div>
          <span className="rounded-full bg-amber-300/10 px-2 py-1 text-xs text-amber-100">{upcomingAlerts.length} {upcomingAlerts.length === 1 ? "aviso" : "avisos"}</span>
        </div>
        <ul className="mt-3 space-y-2">{upcomingAlerts.map(item => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/45 px-3 py-2 text-xs text-slate-200">
            <span className="min-w-0"><strong className="text-white">{item.title}</strong> · {item.type} · {item.due.slice(8,10)}/{item.due.slice(5,7)}</span>
            <span className="font-semibold text-amber-100">{brl(item.amount)}</span>
          </li>
        ))}</ul>
        <p className="mt-2 text-xs text-slate-400">Avisos exibidos ao abrir esta área. Não são notificações push nem confirmam cobranças reais.</p>
      </div>
    )}
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><p className="text-sm text-slate-400">Custo mensal equivalente</p><p className="mt-2 text-xl font-semibold text-white">{brl(monthlyCents)}</p></div>
      <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><p className="text-sm text-slate-400">Custo anual estimado</p><p className="mt-2 text-xl font-semibold text-white">{brl(monthlyCents * 12)}</p></div>
      <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><p className="text-sm text-slate-400">Assinaturas cadastradas</p><p className="mt-2 text-xl font-semibold text-white">{items.length}</p></div>
    </div>
    <div className="rounded-xl border border-violet-400/20 bg-violet-950/20 p-4">
      <h4 className="text-sm font-semibold text-white">Projeção dos custos recorrentes</h4>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[3,6,12].map(months => <div key={months} className="rounded-lg border border-white/10 bg-slate-950/50 p-3"><p className="text-xs text-slate-400">{months} meses</p><p className="mt-1 font-semibold text-white">{brl(monthlyCents * months)}</p></div>)}
      </div>
      <p className="mt-2 text-xs text-slate-400">Projeção média com base nas assinaturas cadastradas, sem reajustes ou novas contratações. O valor efetivamente cobrado em cada mês pode variar para planos anuais.</p>
    </div>
    <div className="space-y-3 rounded-xl border border-violet-400/20 bg-violet-950/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-semibold text-white">Projeção do saldo mensal</h4><p className="text-xs text-slate-400">Despesas futuras e assinaturas descontadas do saldo manual estimado.</p></div><label className="text-sm text-slate-300">Período <select value={horizon} onChange={e=>setHorizon(Number(e.target.value))} className="ml-2 rounded-lg border border-white/20 bg-slate-950 p-2 text-white"><option value={3}>3 meses</option><option value={6}>6 meses</option><option value={12}>12 meses</option></select></label></div>
      {potentialDuplicates.length>0&&<div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-950/20 p-3"><p className="text-sm font-semibold text-amber-200">Possíveis compromissos duplicados</p><p className="text-xs text-slate-300">Encontramos despesas com mesmo nome e valor de uma assinatura. Confirme se deseja ignorá-las apenas nesta projeção; os registros não serão excluídos.</p>{potentialDuplicates.map(item=><label key={item.id} className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={excludedExpenseIds.includes(item.id)} onChange={event=>setExcludedExpenseIds(current=>event.target.checked?[...current,item.id]:current.filter(id=>id!==item.id))}/><span>Ignorar {item.title} ({brl(item.amount_cents)}) na projeção</span></label>)}</div>}
      {firstNegative&&<div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-950/20 p-3"><div><p className="text-sm font-semibold text-rose-200">Seu saldo poderá ficar negativo em {firstNegative.period.slice(5)}/{firstNegative.period.slice(0,4)}.</p><p className="mt-1 text-xs text-rose-100">A MIKA pode ajudar você a reorganizar despesas, revisar assinaturas e simular um plano para equilibrar o orçamento.</p></div><button type="button" onClick={askMyka} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">Replanejar meus gastos com a MIKA</button></div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b border-white/15 text-slate-400"><th className="p-2">Mês</th><th className="p-2">Receitas</th><th className="p-2">Despesas</th><th className="p-2">Assinaturas</th><th className="p-2">Saldo projetado</th></tr></thead><tbody>{projection.map(row=><tr key={row.period} className="border-b border-white/10"><td className="p-2 text-white">{row.period.slice(5)}/{row.period.slice(0,4)}</td><td className="p-2 text-emerald-300">{brl(row.incoming)}</td><td className="p-2 text-slate-300">{brl(row.expenses)}</td><td className="p-2 text-slate-300">{brl(row.subscriptionsDue)}</td><td className={row.position<0?"p-2 font-semibold text-rose-300":"p-2 font-semibold text-emerald-300"}>{brl(row.position)}</td></tr>)}</tbody></table></div>
      <div className="space-y-3 rounded-xl border border-violet-400/25 bg-slate-950/50 p-4"><div><h4 className="font-semibold text-white">Simule um orçamento mais equilibrado</h4><p className="mt-1 text-xs text-slate-400">Ajuste reduções hipotéticas de gastos. Nenhum registro será alterado.</p></div><div className="grid gap-3 sm:grid-cols-2"><fieldset className="space-y-2"><legend className="text-sm font-semibold text-white">Despesas para retirar do cenário</legend>{planned.filter(item=>item.due_date>=asOf&&!excludedExpenseIds.includes(item.id)).length===0?<p className="text-xs text-slate-400">Nenhuma despesa futura cadastrada.</p>:planned.filter(item=>item.due_date>=asOf&&!excludedExpenseIds.includes(item.id)).map(item=><label key={item.id} className="flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={scenarioExpenseIds.includes(item.id)} onChange={e=>setScenarioExpenseIds(old=>e.target.checked?[...old,item.id]:old.filter(id=>id!==item.id))}/>{item.title} · {brl(item.amount_cents)} · {item.due_date.split("-").reverse().join("/")}</label>)}</fieldset><fieldset className="space-y-2"><legend className="text-sm font-semibold text-white">Assinaturas para cancelar no cenário</legend>{items.length===0?<p className="text-xs text-slate-400">Nenhuma assinatura cadastrada.</p>:items.map(item=><label key={item.id} className="flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={scenarioSubscriptionIds.includes(item.id)} onChange={e=>setScenarioSubscriptionIds(old=>e.target.checked?[...old,item.id]:old.filter(id=>id!==item.id))}/>{item.title} · {brl(item.amount_cents)} ({item.billing_cycle==="monthly"?"mensal":"anual"})</label>)}</fieldset></div><fieldset className="space-y-2"><legend className="text-sm font-semibold text-white">Adiar despesas no cenário</legend>{planned.filter(item=>item.due_date>=asOf&&!excludedExpenseIds.includes(item.id)&&!scenarioExpenseIds.includes(item.id)).map(item=><label key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200"><span>{item.title} · {brl(item.amount_cents)} · {item.due_date.split("-").reverse().join("/")}</span><select aria-label={"Adiar "+item.title} value={deferredExpenses[item.id]??0} onChange={e=>setDeferredExpenses(current=>({...current,[item.id]:Number(e.target.value)}))} className="rounded-lg border border-white/20 bg-slate-900 p-2 text-white"><option value={0}>Não adiar</option><option value={1}>Adiar 1 mês</option><option value={2}>Adiar 2 meses</option><option value={3}>Adiar 3 meses</option></select></label>)}</fieldset><p className="text-xs text-slate-400">Despesas adiadas continuam no orçamento no novo mês. Se o novo vencimento cair fora do período analisado, o valor não aparecerá no saldo final simulado.</p><p className="text-xs text-slate-400">As seleções são hipóteses: retiram a despesa inteira ou todas as próximas cobranças da assinatura apenas do cenário. Não cancelam contratos nem modificam lançamentos.</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-slate-300">Redução de assinaturas: {subscriptionSavings}%<input type="range" min="0" max="100" step="5" value={subscriptionSavings} onChange={e=>setSubscriptionSavings(Number(e.target.value))} className="mt-2 w-full accent-violet-500"/></label><label className="text-sm text-slate-300">Redução de despesas planejadas: {expenseSavings}%<input type="range" min="0" max="100" step="5" value={expenseSavings} onChange={e=>setExpenseSavings(Number(e.target.value))} className="mt-2 w-full accent-violet-500"/></label></div><div className="grid gap-2 sm:grid-cols-3"><div><p className="text-xs text-slate-400">Economia simulada</p><p className="font-semibold text-emerald-300">{brl(totalScenarioSavings)}</p></div><div><p className="text-xs text-slate-400">Saldo final simulado</p><p className="font-semibold text-white">{brl(scenario.length?scenario[scenario.length-1].scenarioPosition:0)}</p></div><div><p className="text-xs text-slate-400">Primeiro mês negativo no cenário</p><p className="font-semibold text-white">{scenarioNegative?scenarioNegative.period.slice(5)+"/"+scenarioNegative.period.slice(0,4):"Nenhum no período"}</p></div></div><p className="text-xs text-slate-400">A redução é aplicada proporcionalmente a todas as despesas da categoria, inclusive essenciais. Use apenas para explorar possibilidades, não como plano de cortes automático.</p><button type="button" onClick={askMyka} disabled={!projection.length} className="rounded-lg border border-violet-400 px-3 py-2 text-sm font-semibold text-violet-200 disabled:opacity-50">Conversar com a MIKA sobre este cenário</button></div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-400/20 bg-slate-950/60 p-3"><div><p className="text-sm font-semibold text-violet-200">✦ MYKA · Planejamento financeiro</p><p className="mt-1 text-xs text-slate-300">Converse sobre riscos de saldo negativo e alternativas para organizar seu orçamento. Os números da simulação serão enviados ao chat apenas ao clicar.</p></div><button type="button" onClick={askMyka} disabled={!projection.length} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">Analisar com a MYKA</button></div>
      {handoffError&&<p role="alert" className="text-xs text-rose-300">Não foi possível abrir a análise. Verifique as permissões do navegador.</p>}
      <p className="text-xs text-slate-400">Estimativa com receitas futuras cadastradas manualmente, sem garantia de recebimento, inflação ou gastos não cadastrados. Revise possíveis duplicidades acima. Atualize a página após alterar outros lançamentos.</p>
    </div>
    <div className="space-y-3 rounded-xl border border-emerald-400/20 bg-slate-950/40 p-4"><h4 className="font-semibold text-white">Receitas futuras previstas</h4><p className="text-xs text-slate-400">Cadastre entradas esperadas, como salário ou pagamentos. São previsões manuais, não dinheiro recebido.</p><form onSubmit={addIncome} className="grid gap-2 sm:grid-cols-4"><input required maxLength={100} aria-label="Descrição da receita" placeholder="Ex.: Salário" value={incomeTitle} onChange={e=>setIncomeTitle(e.target.value)} className="rounded-lg border border-white/20 bg-slate-900 p-2 text-white"/><input required inputMode="decimal" aria-label="Valor da receita" placeholder="Valor (R$)" value={incomeAmount} onChange={e=>setIncomeAmount(e.target.value)} className="rounded-lg border border-white/20 bg-slate-900 p-2 text-white"/><input required type="date" aria-label="Data prevista da receita" value={incomeDue} onChange={e=>setIncomeDue(e.target.value)} className="rounded-lg border border-white/20 bg-slate-900 p-2 text-white"/><button disabled={busy} className="rounded-lg bg-emerald-700 p-2 font-semibold text-white disabled:opacity-50">Adicionar receita</button></form><div className="space-y-2">{expectedIncome.map(item=><div key={item.id} className="flex items-center justify-between gap-2 text-sm text-slate-200"><span>{item.title} · {brl(item.amount_cents)} · {item.due_date.split("-").reverse().join("/")}</span><button type="button" onClick={()=>removeIncome(item.id)} className="text-rose-300">Excluir</button></div>)}</div></div>
    <form onSubmit={add} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm text-slate-300">Serviço ou assinatura<input required maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex.: Streaming" className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white"/></label>
      <label className="text-sm text-slate-300">Valor (R$)<input required inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="Ex.: R$ 49,90" className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white"/></label>
      <label className="text-sm text-slate-300">Recorrência<select value={cycle} onChange={event => setCycle(event.target.value as "monthly" | "yearly")} className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white"><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></label>
      <label className="text-sm text-slate-300">Próximo vencimento<input required type="date" value={due} onChange={event => setDue(event.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white"/></label>
      <button type="submit" disabled={busy || loading} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2 lg:col-span-4">{busy ? "Salvando..." : "Adicionar assinatura"}</button>
    </form>
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    <ul className="space-y-2">{items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><div className="min-w-0"><p className="truncate font-medium text-white">{item.title}</p><p className="text-xs text-slate-400">{item.billing_cycle === "monthly" ? "Mensal" : "Anual"} · Próximo vencimento: {item.next_due_date.split("-").reverse().join("/")}</p></div><div className="flex items-center gap-4"><span className="text-sm font-semibold text-white">{brl(item.amount_cents)}</span><button type="button" onClick={() => void remove(item.id)} className="text-xs text-violet-300 hover:text-white">Excluir</button></div></li>)}</ul>
    {!loading && items.length === 0 && <p className="text-sm text-slate-400">Nenhuma assinatura cadastrada.</p>}
  </section>;
}
