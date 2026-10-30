# MYRYRA MVP 1 — Gate P0 de homologação

## Escopo e ambiente
- Branch: `feat/atomo-copiloto-mvp` — Vercel **Preview**, não promover automaticamente para Production.
- Não alterar dados de clientes ou chaves secretas durante smoke tests.
- `READY` comprova build/deploy, **não** autenticação, persistência ou funcionamento do chat.

## Critérios obrigatórios (execução manual autenticada)
- [ ] Login válido abre Dashboard; logout encerra sessão; visitante sem login é redirecionado.
- [ ] Em 360–390 px de largura, navegação, Captura Rápida e Kanban não têm rolagem horizontal.
- [ ] Captura Rápida: duas tarefas, revisar, desmarcar uma, salvar; somente a selecionada aparece no Kanban sem refresh.
- [ ] Recarregar: tarefa persiste; conta B não visualiza nem altera dados da conta A.
- [ ] Dois cliques rápidos em Confirmar não geram tarefas duplicadas.
- [ ] Focus Mode: iniciar, pausar, continuar, mudar aba e voltar; contagem baseada no relógio; recarregar reinicia (comportamento documentado).
- [ ] Daily Briefing, What Now? e Weekly Intelligence carregam sem erros com dados reais; sem dados exibem estados apropriados.
- [ ] MYKA: requisição autenticada retorna resposta válida; conferir logs de `/api/concierge` e ausência de novos erros `Rate limiting não configurado`.
- [ ] Rate limit: após exceder o limite, resposta HTTP 429; sem Redis configurado, HTTP 503, nunca bypass silencioso.
- [ ] Google Calendar desconectado não impede acesso às funções locais.

## Bloqueios de lançamento
- MYKA não comprovada com sessão autenticada; histórico de erros do Redis em deploy antigo.
- Testes reais de UX mobile e isolamento entre contas ainda pendentes.
- Sem validação de cobrança/assinatura e políticas comerciais não habilitar pagamento.
