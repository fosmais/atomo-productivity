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

## Princípio de produto aprovado — Modelo heliocêntrico
**MYRYRA Journey é o Sol:** a jornada do usuário é o núcleo da navegação, do planejamento e da experiência de evolução pessoal. **MIKA é a inteligência orquestradora** e os demais módulos são planetas que apoiam o Journey.

- Agenda reserva tempo para missões; Tarefas executa ações; Finanças apoia metas financeiras; Saúde sustenta bem-estar; Foco ajuda na execução; Score resume progresso; Social viabiliza jornadas coletivas.
- A home deve priorizar: jornada atual, progresso, próxima missão e acesso contextual aos módulos de apoio. Os módulos permanecem utilizáveis de forma independente.
- Integrações entre módulos são opt-in e respeitam permissões granulares, minimização de dados e autorização explícita para ações externas. Dados financeiros e de saúde não são compartilhados automaticamente com participantes.
- O Score deve refletir indicadores explicáveis de evolução, sem punição por condições pessoais ou períodos de inatividade. MYRAs recompensam marcos verificáveis, não o tempo de tela.
- A identidade visual pode usar Sol, órbitas e planetas como metáfora, mas a interface deve continuar simples, responsiva, acessível e em cards.
- Roadmap J1 deve preparar a associação opcional entre jornadas e itens de módulos existentes, sem migração destrutiva nem alteração automática de dados.

## Backlog consolidado MVP2 — Journey como núcleo (aprovado em 09/11/2026)

| ID | Prioridade | Entrega | Dependências / aceite |
| --- | --- | --- | --- |
| JRN-01 | P0 | Fundação de jornadas pessoais, missões e progresso | CRUD, RLS, estados, isolamento e feature flag; API inicial em desenvolvimento, não homologada |
| JRN-02 | P0 | Concluir/reabrir missões e progresso consistente | Contagem server-side, idempotência e testes |
| JRN-03 | P0 | Journey como núcleo da Home | Card jornada atual, próxima missão, progresso e atalhos contextuais; manter módulos independentes |
| JRN-04 | P0 | MIKA Journey Coach | Criar e adaptar trilhas com prévia e confirmação do usuário |
| JRN-05 | P0 | Vínculos opcionais com Agenda e Tarefas | Sem duplicação destrutiva nem execução automática |
| JRN-06 | P1 | Conexões com Finanças, Saúde e Foco | Permissões por módulo, privacidade e consentimento explícito |
| JRN-07 | P1 | MYRA virtual | Ledger idempotente, regras transparentes, limites, reversões e antifraude; sem valor financeiro |
| JRN-08 | P1 | Medalhas, níveis e recompensas digitais | Catálogo cosmético, histórico e acessibilidade |
| JRN-09 | P1 | Journey Together | Convites opt-in, papéis, trilhas compartilhadas, progresso coletivo e isolamento de dados |
| JRN-10 | P1 | Compartilhamento de conquistas | Cards para WhatsApp/redes, prévia e privacidade padrão |
| JRN-11 | P1 | MYRYRA Score conectado ao Journey | Indicadores explicáveis, sem penalização por inatividade |
| JRN-12 | P1 | Identidade visual heliocêntrica | Journey=Sol, ferramentas=planetas, MIKA=orquestradora; UI compacta e responsiva |
| JRN-13 | P0 | Homologação integrada Preview | Testes de regressão, mobile, segurança, custos e rollout controlado |
| JRN-14 | P2 | Benefícios de parceiros para MYRA | **Pós-MVP2**; depende de acordos, avaliação jurídica e modelo comercial |

**Ordem de execução:** JRN-01 → JRN-02 → JRN-03 → JRN-04 → JRN-05 → JRN-06/07/08 → JRN-09/10/11/12 → JRN-13. JRN-14 permanece planejado fora da MVP2. Não ativar Journey para usuários sem homologação; não alterar pagamentos reais ou gate LGPD.

## Redesenho transversal da experiência — Journey-first (diretriz aprovada)

**Objetivo:** não criar uma aba isolada, mas transformar a aplicação em uma experiência contínua de jornada. O Journey é o Sol, a MIKA coordena as ações, e os módulos são planetas de apoio. Não remover funções existentes nem interromper usuários ativos.

### UX-01 — Mapa de navegação e Home (P0)
- Home: hero compacto “Sua jornada”, meta prioritária, percentual de progresso, próxima missão, ação principal “Continuar minha jornada”.
- Segundo nível: órbita de ferramentas contextuais (Agenda, Tarefas, Finanças, Saúde, Foco, Score, Social), com links funcionais e explicação de como cada módulo ajuda a meta.
- Estado sem jornada: onboarding de três passos (escolher objetivo → MIKA sugere trilha → usuário confirma). Permitir pular e usar módulos independentes.
- Usuário com várias jornadas: seletor de jornada ativa e visão “Todas as jornadas”; nenhuma alteração automática da jornada ativa.
- Sem telas excessivamente longas; cards compactos, títulos curtos, hierarquia consistente e menu acessível.

### UX-02 — Navegação global (P0)
- Renomear entrada principal para “Minha jornada” após liberação gradual; manter rotas e deep links antigos.
- MIKA acessível de qualquer módulo; contexto da jornada com consentimento, nunca enviar dados sensíveis sem autorização.
- Cada planeta oferece retorno claro à jornada e ações contextuais: “Adicionar à minha jornada”, “Vincular missão”, “Ver impacto”.
- Mobile: navegação reduzida, atalhos prioritários e acessibilidade com leitor de tela; metáfora visual solar opcional, nunca prejudicar legibilidade.

### UX-03 — Padrão de interface e conteúdo (P0)
- Design system: card de missão, progresso, conquista, ferramenta de apoio, estado vazio, erro, carregamento e permissão.
- Textos orientados à ação e ao benefício, sem promessas irreais; linguagem consistente em todos os módulos.
- Modo claro/escuro, contraste, teclado, responsividade, performance e animações reduzidas.

### UX-04 — Integração contextual dos planetas (P1)
- Agenda reserva tempo para missão; Tarefas detalha ações; Finanças auxilia metas; Saúde e Foco ajudam hábitos; Score resume evolução; Social permite convites.
- Vínculos explícitos e reversíveis, com consentimento por módulo; manter dados privados isolados.
- Eventos de progresso devem ser derivados de ações reais, evitando recompensas por cliques.

### UX-05 — Experiência de retorno (P1)
- Briefing da MIKA: “Onde você está”, “O que avançou”, “Seu próximo passo”; ajustes somente com confirmação.
- Celebrar conquistas sem pressão por streaks; compartilhamento social sempre opcional e com prévia.

### Estratégia de migração e homologação
1. Inventariar telas, fluxos e navegação existentes; mapear para componentes reutilizáveis.
2. Implementar Home Journey-first atrás de flag e preservar Home antiga como fallback.
3. Introduzir navegação e cards padronizados, testando deep links e regressões.
4. Integrar os planetas em blocos, com contratos de dados e permissões.
5. Testar usuários sem jornada, com jornada, com múltiplas jornadas e com acessibilidade/mobile.
6. Ativar gradualmente em Preview e somente depois de validação autorizar produção.

**Critérios de aceite:** o usuário entende sua jornada em até uma tela; chega à próxima missão em até dois toques; navega para qualquer módulo existente sem perda de funções; consegue voltar ao Journey; nenhum dado privado aparece indevidamente; não há regressão no login, Agenda, Tarefas, Finanças ou MIKA.

**Estado:** backlog de redesign aprovado; implementação de interface e rollout pendentes.

## Três pilares inegociáveis do Journey — confirmação de produto

A experiência heliocêntrica não substitui estes pilares; **são o núcleo funcional e critérios obrigatórios de aceite da MVP2**.

1. **Sua trilha inteligente (P0 / JRN-04):** usuário define sonho ou objetivo (ex.: aprender italiano, correr 10 km, juntar R$ 30 mil, mudar de país); MIKA sugere etapas, missões semanais e ações diárias com estimativas realistas. Exibir prévia e exigir confirmação antes de gravar ou replanejar; adaptar à evolução, disponibilidade e permissões.
2. **Moeda MYRA (P1 / JRN-07 e JRN-08):** conceder pontos virtuais apenas após conquista validada, com ledger auditável, idempotência, limites e antifraude. Permitir resgatar temas, medalhas, personalizações da MIKA e itens digitais internos. Sem compra, transferência, saque, cotação ou conversão monetária; benefícios de parceiros são pós-MVP2.
3. **Jornadas compartilhadas (P1 / JRN-09 e JRN-10):** convidar amigos, parceiros ou familiares via aceite opt-in; papéis e permissões claros; progresso individual e coletivo, celebração de marcos, saída/revogação; opção privada como padrão. Nunca expor automaticamente dados financeiros, saúde ou tarefas privadas de participantes.

**Critérios transversais:** onboarding mostra os três benefícios sem prometer funções ainda indisponíveis; testes de privacidade, segurança, duplicidade de MYRAs, replanejamento e convites; nenhuma recompensa concedida por simples clique. Home e navegação devem dar destaque real a trilha, MYRA e compartilhamento, preservando acesso às ferramentas de apoio.

## Três pilares obrigatórios — confirmação de produto

Estes pilares são requisitos de aceite da MVP2, não apenas sugestões visuais.

### Pilar 1: Sua trilha inteligente — P0
- O usuário informa sonho/meta, prazo e disponibilidade (ex.: aprender italiano, correr 10 km, juntar R$ 30 mil, mudar de país).
- A MIKA apresenta um plano **antes de gravar**: etapas, missões semanais e pequenas ações diárias, com critérios de conclusão.
- A pessoa pode aceitar, editar, adiar ou rejeitar; replanejamento deve preservar histórico e exigir confirmação.
- Integrar Agenda, Tarefas, Finanças, Saúde e Foco somente com autorização granular; oferecer fallback sem IA.
- Aceite: fluxo objetivo → prévia → confirmação → jornada → primeira missão concluída, com progresso correto.

### Pilar 2: Moeda MYRA — P1
- MYRA é recompensa virtual por conquistas validadas, sem valor monetário, saque, compra, transferência ou conversão.
- Ledger imutável, idempotência por evento, antifraude, reversões auditáveis e catálogo de recompensas digitais (temas, medalhas, personalização da MIKA).
- Exibir regras transparentes e saldo; não premiar simples tempo de tela, nem incentivar uso compulsivo.
- Aceite: uma conclusão elegível gera um único crédito; repetição da mesma ação não duplica MYRAs; resgate virtual controlado e reversível quando aplicável.

### Pilar 3: Jornadas compartilhadas — P1
- Convites opt-in para amigos, parceiros e familiares, com papéis e autorização explícita.
- Trilhas privadas por padrão; participantes visualizam somente dados da jornada compartilhada e contribuições autorizadas.
- Marcos coletivos, progresso individual e coletivo, comemorações e opção de sair/revogar acesso.
- Nunca expor dados de Saúde, Finanças ou outras áreas privadas automaticamente.
- Aceite: convidar → aceitar → contribuir → celebrar; convite recusado ou revogado não permite acesso.

**Dependência do redesign:** Home Journey-first e metáfora Sol/planetas devem facilitar os três pilares, não substituí-los. O rollout requer homologação funcional, mobile, segurança e controle de custos. Benefícios de parceiros permanecem pós-MVP2.
