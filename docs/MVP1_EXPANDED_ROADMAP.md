# MYRYRA — MVP 1 ampliado (aprovado em 2026-10-30)

## Escopo aprovado: cinco funcionalidades

| Funcionalidade | Base encontrada | Entrega do MVP 1 | Estado |
|---|---|---|---|
| What Now? | `what-now.tsx` recomenda por prioridade e vencimento a partir de Cloud Plans | Incorporar tempo livre e compromissos; sugerir próxima ação explicável | Parcial |
| Daily Briefing | `daily-copilot.tsx` e `daily-planner` | Resumo automático de compromissos, prioridades, conflitos e tempo disponível | Parcial |
| Captura Rápida / Brain Dump | MYKA já propõe tarefas via Concierge | Campo de texto para múltiplas tarefas, revisão e confirmação explícita antes de salvar | Pendente |
| Focus Mode | Novo `focus-mode.tsx` integrado ao Planner | Timer 15/25/45/60 min, pausa e reinício | Implementado no código; QA pendente |
| Weekly Intelligence Lite | `performance-insights.tsx` e `vyra-period-metrics` | Resumo semanal simples, concluídas, atrasadas e evolução | Parcial |

## Ordem de execução
1. Focus Mode: validar build, mobile e timer; considerar persistência posterior.
2. Captura Rápida: aproveitar proposta de tarefas existente e exigir confirmação individual.
3. Daily Briefing: reunir agenda, tarefas e janelas livres, evitando chamadas desnecessárias de IA.
4. What Now?: recomendar uma única ação viável com base no tempo disponível.
5. Weekly Intelligence Lite: aproveitar métricas existentes e evitar duplicar cálculos.

## Critérios de aceite
- Sem alteração dos planos gratuitos da infraestrutura.
- Sem criar tarefas ou eventos sem consentimento explícito.
- Todas as consultas e gravações respeitam a sessão e RLS do usuário.
- Layout funcional em celular e desktop.
- Testar fluxos autenticados e persistência antes de declarar concluído.
- Não bloquear o lançamento por integrações de Google Maps, voz ou Business.

## Ampliação aprovada — acesso seguro e favoritos (2026-10-30)

| Entrega | Escopo MVP 1 | Critério de aceite | Estado |
|---|---|---|---|
| Login MYRYRA | Identidade roxa/dark, responsividade, acessibilidade e mensagens de erro | Login e cadastro existentes preservados; QA mobile | Layout atualizado; QA pendente |
| MFA TOTP | Enrolamento com QR/segredo, verificação do código, gerenciamento e recuperação segura | Desafiar sessão AAL1 quando houver fator verificado; bloquear rotas protegidas até AAL2; testar login, logout e recuperação | Pendente de implementação |
| Favoritos | Favoritar/desfavoritar tarefas e eventos, visualização unificada | Persistência por usuário com RLS; sem acesso entre contas; mobile | Pendente de implementação |

### Ordem de entrega e segurança
1. Login visual e testes de regressão.
2. MFA nativo Supabase Auth com enforcement também no servidor, sem guardar segredos TOTP na aplicação; definir fluxo de recuperação antes de liberar.
3. Favoritos com tabela associada a `auth.uid()`, unicidade por item e RLS; integrar tarefas e agenda.
4. Testes automatizados, autenticação real e homologação mobile. Nenhuma funcionalidade será declarada concluída antes do QA.


## Ampliação aprovada — integrações externas e importação (2026-11-02)

As opções já exibidas na tela de integrações devem ser entregues funcionalmente na MVP1. Exibição de cards e links de documentação **não** constitui integração concluída.

| Entrega | Escopo da MVP1 | Prioridade | Estado |
|---|---|---|---|
| Importação manual CSV | Importar tarefas por arquivo com pré-visualização, mapeamento de campos, confirmação e prevenção de duplicidade | P0 | Validar fluxo existente em `src/app/dashboard/manual-task-import.tsx` |
| Google Tasks | Conectar conta Google mediante consentimento e importar listas/tarefas sob demanda | P1 | Pendente |
| Todoist | Autorização OAuth, seleção de projetos e importação de tarefas sob demanda | P1 | Pendente |
| Microsoft Outlook | Autorização Microsoft Graph e consulta/importação de compromissos do calendário sob demanda | P1 | Pendente |

### Ordem e critérios de aceite
1. Homologar CSV com dados válidos, inválidos, duplicados e isolamento por usuário.
2. Implementar Google Tasks reutilizando somente o que for compatível da autenticação Google existente; validar escopos OAuth adicionais.
3. Implementar Todoist com OAuth, seleção explícita e importação sem exclusão/alteração remota.
4. Implementar Outlook com Microsoft Graph, consentimento e seleção de calendário; não confundir Outlook Calendar com Microsoft To Do.
5. Exibir estados claros de conexão, sincronização, erro e última importação; garantir funcionamento em desktop e mobile.
6. Manter importação inicial unidirecional e sob demanda. Sincronização automática/bidirecional fica fora deste escopo até avaliação de conflitos, custos e consentimento.
7. Tokens OAuth somente no servidor e protegidos; respeitar RLS e isolamento entre contas. Nenhuma integração será marcada concluída sem testes reais.

**Dependência de execução:** após estabilização do Bloco 2 (Asaas Sandbox, persistência e conciliação), iniciar este bloco de integrações; CSV pode ser homologado em paralelo.
