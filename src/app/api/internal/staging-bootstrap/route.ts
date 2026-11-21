import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const owner = "fosmais";
const repo = "atomo-productivity";
const branch = "feat/mvp2-professora-journey-myra-26";
const workflow = "journey-auth-staging.yml";

async function authorize() {
  // Never permit a test dispatch from a production deployment.
  if (process.env.VERCEL_ENV !== "preview" || process.env.MYRYRA_STAGING_TEST_CONSOLE_ENABLED !== "true") return false;
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return false;
  const allowed = (process.env.MYRYRA_STAGING_TEST_ADMIN_IDS ?? "").split(",").map(x => x.trim()).filter(Boolean);
  return allowed.includes(data.user.id) && data.user.app_metadata?.role === "admin";
}

export async function GET() {
  if (!(await authorize())) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const token = process.env.MYRYRA_STAGING_GITHUB_TOKEN;
  if (!token) return NextResponse.json({ configured: false, message: "GitHub token de staging não configurado" }, { headers: { "Cache-Control": "no-store" } });
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/runs?branch=${encodeURIComponent(branch)}&per_page=5`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    cache: "no-store",
  });
  if (!response.ok) return NextResponse.json({ error: "Não foi possível consultar o GitHub Actions" }, { status: 502 });
  const payload = await response.json();
  return NextResponse.json({ configured: true, runs: (payload.workflow_runs ?? []).map((run: { id: number; status: string; conclusion: string | null; html_url: string; created_at: string }) => ({
    id: run.id, status: run.status, conclusion: run.conclusion, url: run.html_url, created_at: run.created_at,
  })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await authorize())) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const token = process.env.MYRYRA_STAGING_GITHUB_TOKEN;
  if (!token) return NextResponse.json({ error: "GitHub token de staging não configurado" }, { status: 503 });
  const body = await request.json().catch(() => null);
  // Only the bootstrap is allowed here. No arbitrary workflows, branches or concurrency.
  if (!body || body.action !== "bootstrap") return NextResponse.json({ error: "Ação não permitida" }, { status: 400 });
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    body: JSON.stringify({ ref: branch, inputs: { bootstrap_synthetic_accounts: "true", run_mika_concurrency: "false" } }),
    cache: "no-store",
  });
  if (response.status !== 204) return NextResponse.json({ error: "O GitHub não aceitou o acionamento; verifique as permissões do token e do workflow" }, { status: 502 });
  return NextResponse.json({ requested: true, message: "Bootstrap solicitado; acompanhe o resultado antes de avançar." }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
