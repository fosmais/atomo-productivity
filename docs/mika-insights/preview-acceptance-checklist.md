# MIKA Insights — roteiro de homologação autenticada (Preview)

**Escopo:** somente branch `feat/mika-insights-mvp2`, PR #65. Não executar em produção. Não habilitar cobrança nem mesclar na `main`.

## Pré-condições
- Abrir o deployment READY mais recente da branch no celular e no desktop.
- Entrar com uma conta de teste autenticada no Supabase Preview.
- Confirmar que o ambiente usa o projeto Supabase Preview, não PROD.
- Não usar dados pessoais sensíveis nos testes.

## Cenários funcionais (registrar PASS/FAIL, dispositivo, horário e evidência)
1. **Captura:** escrever ideia, salvar, atualizar página; conferir conteúdo e data/hora.
2. **Voz:** permitir microfone, gravar frase curta, parar; conferir transcrição, revisar texto, salvar e atualizar página. Negar microfone e verificar mensagem de erro e alternativa de digitação.
3. **Plano:** solicitar sugestão da MIKA; conferir até 8 ações, prioridades e datas válidas. Antes de clicar em salvar, atualizar página e confirmar que a sugestão não foi persistida automaticamente.
4. **Persistência explícita:** gerar sugestão novamente, clicar em salvar plano na ideia, atualizar página e conferir ações persistidas. Confirmar que nenhuma tarefa foi criada na Agenda.
5. **Edição:** alterar ideia com plano salvo; conferir que o plano anterior é invalidado e pode ser gerado novamente.
6. **Arquivar/restaurar:** arquivar e conferir aba de arquivadas; restaurar e conferir estado e plano salvo, quando aplicável.
7. **Excluir:** confirmar diálogo, excluir, atualizar página e conferir ausência.
8. **Duas sessões:** abrir mesma ideia em duas abas/dispositivos; editar na sessão A e tentar editar, arquivar, restaurar ou excluir com versão antiga na sessão B. Esperado: operação B bloqueada, sem sobrescrever o estado atual.
9. **Isolamento:** com duas contas de teste, confirmar que uma conta não visualiza nem altera ideias da outra.
10. **Mobile:** repetir captura, voz, plano, edição, arquivamento e exclusão em Android; verificar layout, teclado, permissões e navegação.

## APIs e limites (teste autenticado)
- `POST /api/mika-insights/suggest`: UUID inválido (400), ideia de outro usuário (404), arquivada (409), JSON > 4096 bytes (413), limite de quota (429), caso válido (200).
- `POST /api/mika-insights/transcribe`: multipart malformado (400), MIME não permitido (415), áudio > 10 MB (413), payload > 11 MB (413), limite de quota (429), áudio válido (200).
- Sem sessão: ambas as APIs devem responder 401; sem cache de respostas com dados pessoais.

## Evidências e critérios de saída
- Registrar resultado por cenário, versão/commit do deployment e eventuais erros.
- Verificar logs sem expor chaves, áudio ou dados pessoais.
- Revisar avisos do Supabase Security Advisor e permissões das funções privilegiadas.
- Confirmar CI/lint independentemente do build Vercel.
- Só considerar PR pronto para revisão final após todos os cenários P0 passarem.
- Merge e qualquer mudança em produção exigem autorização explícita.

## Evidências técnicas registradas — 20/11/2026
- **CI GitHub Actions:** PASS — run `44853190849`, commit `10cb12feaea0e38ffb5cfa0e59a73a21d7ef37e8`; `npm ci`, ESLint, `next typegen` e `tsc --noEmit` concluídos com sucesso.
- **Vercel Preview:** READY — deployment do commit `10cb12f`; isso não equivale a um teste funcional autenticado.
- **Supabase Preview (`xanavauqzsrgvdfhcrsm`):** RLS habilitado nas tabelas `mika_ideas`, `mika_action_proposals` e `mika_action_audit`. Políticas restringem leitura ao proprietário; ideias permitem CRUD do proprietário; propostas/auditoria não concedem escrita direta ao papel `authenticated`.
- **Funções privilegiadas:** `mika_consume_ai_quota`, `mika_decide_proposal` e `mika_execute_approved_task` negam EXECUTE a `anon` e `PUBLIC`, concedem a `authenticated`; revisão de código confirma verificações de identidade e controles de acesso. **Alertas do Security Advisor continuam abertos** para as três funções `SECURITY DEFINER` expostas.
- **Segurança Auth:** aviso de proteção contra senhas vazadas desativada no Preview permanece aberto; não houve alteração da configuração.
- **SQL transacional:** testes anteriores de propriedade, concorrência, autorização e persistência passaram com rollback, sem substituir testes de interface/API.

### Pendências obrigatórias antes de solicitar revisão final
- [ ] Executar cenários funcionais 1–10 com sessão autenticada e registrar PASS/FAIL, horário, dispositivo e evidência.
- [ ] Executar casos HTTP reais (401/400/404/409/413/415/429/200), inclusive limites de payload e concorrência.
- [ ] Revisar e deliberar sobre os avisos de funções `SECURITY DEFINER` e proteção de senhas vazadas.
- [ ] Verificar a experiência Android e a captura real de áudio com consentimento.
- [ ] Revalidar CI e deployment no commit final após eventuais ajustes.

**Estado:** homologação funcional P0 ainda não concluída; PR deve permanecer draft. Nenhum merge, deploy em PROD ou cobrança real autorizado por este documento.

## Evidência declarada pelo homologador — 20/11/2026
- **Cenários 5–7 (edição, arquivamento/restauração, exclusão):** PASS informado pelo usuário para os quatro comportamentos no Preview. Registro baseado na confirmação do homologador, **não** em execução automatizada pelo assistente; dispositivo, horário exato e capturas não fornecidos.
- **Cenários 8–9 (concorrência e isolamento):** ainda aguardam validação funcional com duas sessões/contas. Os testes SQL anteriores não substituem essa etapa.
