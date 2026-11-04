# MYRYRA — Implantação MVP2 (controle de execução)
Atualização: 2026-11-04. Branch: feat/myryra-mvp1-billing-foundation.
Este arquivo é o plano operacional. Não equivale a homologação concluída.

## Política de entrega
Status: BACKLOG > EM DESENVOLVIMENTO > EM HOMOLOGAÇÃO > APROVADO > PRODUÇÃO.
Cada item exige evidência de teste, responsável, dependências, data-alvo e rollback.
Checkout e cobrança real DESABILITADOS até autorização expressa do proprietário.
Não publicar produção sem validar autenticação, permissões e dados de usuários.

## Onda 1 — 04 a 08/11 — P0 estabilidade e bugs de testadores
- [ ] AUTH-01 Google OAuth branding MYRYRA, callback oficial, consent screen, contas externas; validar login/logout/recuperação/MFA.
- [ ] UX-01 Login explica benefícios e CTA, acessível e responsivo.
- [ ] AGENDA-01 Bloquear agendamento retroativo acidental no cliente e servidor; fuso e exceção histórica explícita.
- [ ] AGENDA-02 Disponibilidade unificada sem duplicidade (eventos locais, tarefas, Google opcional).
- [ ] AGENDA-03 Renomear títulos de tarefas/eventos após salvar, persistência e permissões.
- [ ] MIKA-01 Histórico, erro/retry, quotas, anexos, voz e confirmações; testes com dois usuários.
- [ ] CONCIERGE-01 Auditar e homologar /api/concierge, autenticação, quotas, histórico persistente, tarefas e eventos propostos com confirmação; verificar conflitos e isolamento entre usuários.
- [ ] OPS-01 Monitoria, erros, segurança, secrets, regressão e plano de rollback.
Aceite: nenhuma falha P0 aberta, testes reais com usuários distintos, nenhum vazamento, cobrança desativada.

## Onda 2 — 09 a 15/11 — P1 comercialização e operação (trilhas paralelas)
- [ ] BILL-01 Asaas sandbox: criação de cliente/assinatura, PIX quando suportado, webhooks assinados, idempotência, persistência, conciliação, cancelamento e falhas.
- [ ] BILL-02 Planos/checkout: estados claros, ajuda MIKA, nenhum pagamento real.
- [ ] MAIL-01 Verificar DNS e autenticação do provedor, envio de teste, SPF/DKIM/DMARC, entregabilidade e templates (boas-vindas, acesso, cobrança, suporte).
- [ ] SUPPORT-01 Ticket via MIKA, painel admin, status, notificações, base de conhecimento.
- [ ] ANDROID-01 Expo/EAS build instalável, login, sessão, testes em aparelho, permissões e deep links.
- [ ] UX-02 Busca Metas Rápidas, lixeira/restauração com política de retenção, correções mobile.
Aceite: sandbox reconciliado, emails reais de teste entregues, APK instalado e fluxos essenciais funcionais.

## Onda 3 — 16 a 22/11 — P1/P2 inteligência útil
- [ ] ALERT-01 Android push consentido com app fechado, horário/fuso, sem duplicação, revogação e privacidade; backend e tokens.
- [ ] MIKA-02 DOCX, histórico e propostas/confirmar, contexto de Agenda/Finance.
- [ ] CONCIERGE-02 Integrar Concierge à experiência MIKA (sem assistente duplicado): planejamento contextual, prioridades, follow-ups e lembretes consentidos, com preferências, opt-out e rastreabilidade. WhatsApp somente com autorização explícita e infraestrutura validada.
- [ ] FIN-01 Saldos manuais, despesas pagas/pendentes, investimentos, metas e recomendações educacionais da MIKA.
- [ ] AI-01 What Now?, Daily Briefing e AutoPilot com confirmação do usuário; Focus/Smart Calendar conforme capacidade.
Aceite: notificações verificadas em aparelho fechado; fluxos Finance/MIKA homologados.

## Onda 4 — 23 a 30/11 — release candidate e lançamento controlado
- [ ] QA-01 Regressão web+Android, segurança, acessibilidade, suporte, monitoria, backup/rollback.
- [ ] BILL-03 Revisão de autorização comercial e configuração de produção; sem ativação automática.
- [ ] ANDROID-02 Play Console, política de privacidade, ficha, capturas, AAB assinado, testes internos/fechados, submissão.
- [ ] WEB-01 QR code Google Play somente após URL pública válida.
- [ ] GROW-01 Metas, score/compartilhamento, feedback e aquisição orgânica conforme resultados.
Aceite: go/no-go documentado. Google Play pode depender de revisão externa e extrapolar 30/11.

## Pós-lançamento — P3
Teams, Google Tasks/Todoist/Outlook, viagens, Smart Commute/Maps Routes, internacionalização, relatórios avançados.

## Concierge — critérios de aceite e dependências
- P0 (Onda 1): endpoint existente auditado e funcional em homologação; histórico e propostas vinculados ao usuário; nenhuma tarefa/evento criada sem confirmação; erros de IA e limites tratados; testes de segurança e permissões.
- P2 (Onda 3): Concierge proativo integrado à MIKA e à Agenda; lembretes e follow-ups opt-in, deduplicação, respeito ao fuso e opção de desativar. Não prometer WhatsApp sem integração e consentimento.
- A implementação preexistente de /api/concierge NÃO comprova homologação nem publicação em produção.

## Concierge completo — escopo recuperado da visão original (25/10/2026)
O Concierge é uma capacidade da MIKA, não outro chatbot. A proposta vai além de agenda e chat.

### Mobilidade / Smart Commute — fase posterior, integração pendente
- Ler endereço e horário do compromisso na agenda, pedir origem e modal de transporte quando necessário.
- Consultar rotas e trânsito com provedor autorizado; estimar duração e sugerir saída com margem configurável.
- Alertar sobre deslocamentos conflitantes, mudanças de trânsito e hora de sair somente com consentimento.
- Explorar estacionamento, custos e táxi/alternativas, condicionados a dados e parceiros disponíveis.
- Dependência histórica: Google Maps Routes API foi adiada após erro 403/configuração de faturamento; não declarar cálculo de trânsito em tempo real até integração validada.

### Restaurantes, reservas e experiências — fase posterior, parceiros pendentes
- Buscar restaurantes por proximidade, preferências e contexto do compromisso; sugerir almoço, jantar e happy hour.
- Consultar disponibilidade de reserva apenas com provedor de reservas integrado; apresentar opções verificadas.
- Exigir confirmação explícita antes de qualquer reserva, pagamento ou alteração.

### Viagens e hospedagem — fase posterior
- Planejar viagens e estadias, pesquisar hotéis e conectar deslocamentos, compromissos e possíveis reservas.
- Consultas de preço, disponibilidade e reserva dependem de integrações/parceiros e consentimento.

### Inteligência contextual — evolução MIKA
- Combinar agenda, tarefas, prioridades e preferências para antecipar necessidades, sugerir planos e follow-ups.
- Exibir origem da informação, sinalizar dados indisponíveis e nunca afirmar ter consultado trânsito ou disponibilidade sem consulta real.
- Opt-in para notificações, respeito ao fuso, privacidade, controle de frequência e opção de desativar.

### Sequência e critérios de aceite
1. Onda 1: homologar o Concierge existente, autenticação, contexto, propostas e confirmação.
2. Onda 3: experiência contextual e proativa da MIKA, sem executar ações externas automaticamente.
3. Pós-lançamento: Mobility/Smart Commute, Dining & Experiences e Travel, depois de integrar e testar provedores.
4. Validar rotas reais, precisão de horário de saída, consentimento e reserva com parceiro antes de divulgar como funcionalidade ativa.

## Evidências de início
- 2026-11-04: correção MIKA de arquivo vazio no cliente, commit 4d90b5c38b218be01a363e2e60c51813200122b3.
- Itens sem evidência permanecem pendentes, mesmo quando há código existente.
