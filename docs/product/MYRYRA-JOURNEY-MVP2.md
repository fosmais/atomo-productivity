# MYRYRA Journey — Especificação MVP2 (aprovada)

## Visão e decisões
Transformar **Minha Meta Atual** em jornadas pessoais e compartilhadas, com planejamento adaptativo pela MIKA, missões, progresso e recompensas virtuais **MYRA**. Benefícios de parceiros ficam fora da MVP2, para fase futura e aprovação comercial/jurídica. MYRA não é moeda financeira, não pode ser sacada, transferida, comprada ou convertida em dinheiro.

## Etapas e critérios de aceite
### J1 — Fundação (P0)
- Entidades: journeys (owner_id, title, category, privacy, status, target_date), journey_members (user_id, role, invitation_status), milestones, missions (due_at, status, evidence_type), mission_completions e journey_activity.
- Relacionar metas existentes sem migração destrutiva; usar feature flag `MYRYRA_JOURNEY_ENABLED` desativada inicialmente.
- RLS por proprietário e membro aceito; membros não podem acessar dados privados de outros módulos.
- Jornada pessoal funcional com criação, edição, pausa, conclusão e progresso calculado no servidor.
- Índices por owner_id, journey_id, due_at; paginação e isolamento entre usuários.

### J2 — MIKA Journey Coach (P0)
- MIKA propõe trilha a partir de meta, prazo e disponibilidade; usuário confirma antes de gravar.
- Missões podem vincular tarefas, agenda, saúde e finanças somente com escopo autorizado.
- Replanejamento com prévia e confirmação; nunca executar compras, pagamentos ou compartilhar dados automaticamente.
- Fallback determinístico quando IA indisponível; limites de custo, rate limiting e observabilidade sem dados sensíveis em logs.

### J3 — MYRA Rewards (P1)
- Ledger imutável de eventos de recompensa com idempotency_key única por usuário/evento; saldo derivado de lançamentos, nunca atualizado diretamente pelo cliente.
- Pontuação por missão validada e marco, limites diários, reversões auditáveis, proteção contra repetição/autoatribuição e fraude.
- Medalhas, níveis e recompensas digitais cosméticas; sem valor monetário, câmbio, promessa de rendimento ou resgate financeiro.
- O usuário pode visualizar histórico e regras transparentes de pontuação.

### J4 — Journey Together (P1)
- Convites opt-in com expiração, aceite explícito, papéis owner/member, saída e remoção.
- Privacidade padrão **privada**; compartilhamento por jornada, nunca por conta inteira.
- Progresso coletivo, missões colaborativas, desafios opcionais e cards sociais sem informações pessoais sensíveis por padrão.
- Limites contra spam, abuso e convites indesejados.

### J5 — Parceiros (P2, pós-MVP2)
- Futuro catálogo de benefícios, parceiros, cupons e regras próprias. Não implementar checkout, carteira monetária nem integração financeira nesta fase.

## UX
- Substituir/expandir card **Minha Meta Atual** com: Minha trilha, Próxima missão, Progresso, MYRAs, Conquistas e Convidar amigos.
- Visual compacto em cards, responsivo, acessível; explicações curtas “Como funciona”.
- Compartilhamento somente por ação do usuário, com prévia e controle de privacidade.

## Ordem de entrega
1. Contratos, esquema e RLS revisados; migração reversível.
2. CRUD e progresso de jornada pessoal; testes de isolamento.
3. MIKA propõe missões e usuário confirma.
4. Ledger MYRA e antifraude; testes de concorrência/idempotência.
5. Convites e jornadas coletivas; testes de permissão e privacidade.
6. Homologação Preview desktop/mobile, custos e rollout gradual para PROD mediante autorização.

## Testes mínimos
- Usuário A não consegue ler ou alterar jornada privada de B.
- Convite pendente não dá acesso; aceite habilita apenas jornada específica.
- Mesma missão concluída duas vezes não gera MYRAs duplicadas.
- Reversão de conclusão preserva trilha de auditoria.
- Replanejamento da MIKA não modifica tarefas sem confirmação.
- Jornada coletiva não expõe lançamentos financeiros, dados de saúde nem calendários privados.
- Feature flag desligada mantém Minha Meta Atual funcionando sem regressão.

**Estado:** escopo aprovado; implementação ainda pendente. LGPD e pagamentos reais são iniciativas separadas e permanecem sob suas próprias restrições de liberação.
