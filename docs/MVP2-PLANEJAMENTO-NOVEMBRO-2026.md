# MYRYRA — MVP2 (novembro de 2026)

## Decisão de produto — 02/11/2026
MVP1 encerrada por decisão de escopo. A MVP2 reúne as pendências da MVP1, as funcionalidades planejadas para novembro e os feedbacks do grupo fechado de testadores.

## Política de publicação
- Production: www.myryra.com. Grupo de confiança testa no dia a dia.
- Preview: desenvolver, validar e testar regressões antes de promover.
- Não habilitar checkout, cobrança, provisionamento financeiro ou cancelamentos reais sem autorização expressa.
- Preservar funcionalidades já homologadas; mudanças com testes de regressão e rollback possível.
- Registrar feedbacks com reprodução, severidade, responsável, status e versão.
- MVP1 encerrada não significa ausência de defeitos.

## Prioridades
### P0 — estabilidade e confiança (semana 02–08/11)
- Validar login Google/e-mail, callbacks e redirecionamento do domínio antigo para Production.
- Validar MYKA: respostas estruturadas, tarefas, eventos, datas/horários e persistência.
- Validar Agenda e Google Calendar: leitura, seleção, sincronização, fuso horário.
- Validar isolamento de contas, autenticação, limites Free e acesso ao suporte.
- Validar planos informativos, ausência de cobranças reais e mensagens comerciais consistentes.
- Revisar logs, erros, monitoramento e capacidade de rollback.

### P1 — pendências herdadas da MVP1
- Suporte pela MYKA: criação real de tickets, acompanhamento, notificações, base de conhecimento e painel administrativo.
- Planos/entitlements: homologação Pro de teste por usuário, conciliação Asaas sandbox, fluxo comercial e checkout somente após aprovação.
- UX: login, planos, Ajuda MYKA, chat, navegação e responsividade; eliminar rolagens confusas.
- Tarefas/Agenda: exclusão, confirmação, favoritos no cadastro, visão Hoje simplificada.
- Android Expo: build, homologação, publicação futura e QR code quando houver link oficial.
- Testes automatizados e pipeline de regressão para fluxos críticos.

### P2 — roadmap de novembro
- What Now?, Daily Briefing, AutoPilot e Focus Mode.
- Smart Calendar, Goal-to-Action, metas pessoais e score compartilhável (inclusive WhatsApp).
- Weekly Intelligence, Performance & Insights, Energy Planner e Life Balance.
- Inbox Zero, importação manual de tarefas; integrações Todoist, Google Tasks e Outlook conforme viabilidade.
- MYKA por voz e arquivos, internacionalização pt-BR/en-US.
- Smart Commute e recursos de viagens sujeitos a viabilidade/custos de APIs.
- MYRYRA Business/Teams: descoberta e desenho antes de desenvolvimento.

## Cadência
- Feedbacks dos testadores: triagem diária; P0 imediato; P1 no próximo bloco; P2 no roadmap.
- Releases pequenos e reversíveis durante os testes, com notas de versão.
- Revisão semanal de bugs, uso, retenção, custos, segurança e prioridades.
- Nada de funcionalidades inacabadas expostas como prontas.

## Definição de pronto
Código revisado; testes executados; Preview validado; sem regressão conhecida; publicação Production confirmada; monitoramento pós-deploy; documentação e feedback atualizados.
