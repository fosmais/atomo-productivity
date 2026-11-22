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


## Plano de entrega de 02/11/2026 — congelamento de escopo e backlog preservado

**Objetivo:** publicar hoje uma versão web estável com funcionalidades já comprovadas, sem declarar concluídas as funcionalidades não homologadas. A versão Android só será anunciada se houver APK instalável e teste real. O Asaas permanece em Sandbox, sem cobrança real ou concessão automática de acesso até testes financeiros e aprovação explícita.

### P0 — portão de lançamento (hoje)

| Frente | Critério objetivo de saída | Estado em 02/11 |
|---|---|---|
| Build web Preview | Vercel READY no commit de release | READY no commit `ebfbd938`; QA funcional pendente |
| Login/cadastro, Google e MFA | Entrar/sair, recuperar acesso e validar AAL2 em rotas protegidas | Revalidar na versão candidata |
| Dashboard, Hoje, tarefas e agenda | Criar, editar, concluir/excluir, salvar e recarregar; testar isolamento entre usuários | QA pendente |
| MYKA / Copiloto | Responder, sugerir ações e só persistir após confirmação | QA pendente |
| Responsividade, navegação e ajuda | Sem erro bloqueante em desktop/mobile, login, planos e ajuda | QA pendente |
| Segurança e observabilidade | Sem segredos no cliente, erros críticos verificados, rollback disponível | QA pendente |
| Publicação web | Promover somente build testado; smoke test em domínio público | Pendente |

### Backlog preservado — não bloquear a publicação web estável

| Prioridade | Funcionalidade ou pendência | Critério de conclusão |
|---|---|---|
| P1 | Asaas: PIX, cartão, checkout e assinatura | Homologação Sandbox ponta a ponta, duplicidade, estorno, conciliação, acesso transacional e aprovação antes de cobranças reais |
| P1 | Fila Asaas: webhook, worker, retry e recuperação de lease expirado | Testes de concorrência, idempotência, falhas e auditoria; flags desativadas até aprovação |
| P1 | APK Android / Expo e publicação Google Play | Build EAS instalável, autenticação e fluxos principais testados; depois publicação na loja e QR no login |
| P1 | CSV / Brain Dump | Pré-visualização, confirmação, deduplicação e isolamento por usuário |
| P1 | Google Tasks | OAuth e importação sob demanda testados |
| P1 | Todoist | OAuth, projetos e importação sob demanda testados |
| P1 | Outlook Calendar | Microsoft Graph, consentimento e importação sob demanda testados |
| P1 | Suporte MYKA e painel admin | Ticket, acompanhamento, notificações, base de conhecimento e priorização com testes reais |
| P1 | Daily Briefing, What Now?, Focus Mode, Weekly Intelligence Lite | Critérios originais acima, persistência e QA mobile |
| P1 | Favoritos e metas pessoais | Estrela integrada na criação/edição, persistência RLS, gamificação e compartilhamento opt-in |
| P1 | Score e compartilhamento WhatsApp | Score confiável na home, compartilhamento voluntário com rosto da MIKA |
| P1 | Voz e upload de arquivos da MYKA | Permissões, tipos/tamanhos permitidos, segurança e QA Android/web |
| P1 | Google Calendar e Smart Calendar | Sincronização, fuso horário, sugestões de slots e prevenção de conflitos |
| P1 | UX e acessibilidade | Revisar login/planos, CTAs, ajuda MIKA, ícones, navegação e identidade visual |
| P2 | AutoPilot, Inbox Zero, Energy Planner, Goal-to-Action, Life Balance | Fluxos completos e consentimento explícito |
| P2 | Smart Commute e integrações Maps/viagens | Retomar Routes API após resolver permissões e custos; estacionamento/hotéis/viagens |
| P2 | Planejamento, Foco, Equilíbrio e Performance avançados | Métricas verificáveis e explicações em Como funciona |
| P2 | Internacionalização pt-BR/en-US e MYRYRA Business/Teams | QA de idiomas, modelo de organizações e permissões |
| P2 | Sincronização bidirecional/automática com terceiros | Resolver conflitos, custos, rate limits e autorização |
| P2 | SEO, aquisição orgânica e automações operacionais | Métricas, indexação e funil verificáveis |

### Governança do progresso

- **90%** é apenas a referência histórica estimada de desenvolvimento, não aprovação de homologação.
- Registrar separadamente: implementado, publicado em Preview, testado, homologado e publicado em produção.
- Nenhuma linha sai do backlog por simplificação de escopo; mover somente com evidência verificável.
- Não promover Preview a produção nem habilitar checkout, entitlements ou cobranças reais sem QA e autorização.
