# MIKA Professora — gate de homologação (MVP2)

Status: **não homologado**. Este documento não autoriza publicação.

## Pré-requisitos
- Usar um banco de homologação com `myryra_journeys` e políticas de propriedade já migradas.
- Aplicar `docs/sql/mika-teacher-sessions.sql` **somente nesse banco**, após revisão de migração.
- Criar dois usuários de teste distintos (A e B), com jornadas ativas próprias.
- Não usar dados pessoais reais; não executar em produção.
- Verificar as permissões efetivas de `authenticated` e a exposição pela Data API.

## Testes obrigatórios
1. **Acesso anônimo:** GET/POST de sessões, GET de mensagens e DELETE devem retornar 401.
2. **MFA:** usuário que exige AAL2 não pode prosseguir em AAL1.
3. **Isolamento:** A não pode consultar, retomar nem excluir sessões de B; B não pode inserir mensagens na sessão de A, inclusive via Data API.
4. **Jornada:** sessão só pode ser criada para jornada ativa pertencente ao usuário; IDs inválidos, jornadas pausadas e arquivadas devem falhar.
5. **Persistência:** criar sessão, enviar mensagem, verificar par usuário/MIKA salvo, recarregar e retomar conversa em ordem cronológica.
6. **Falha de gravação:** simular falha de insert e confirmar aviso de resposta não salva, sem alegar progresso concluído.
7. **Exclusão:** confirmação no cliente, DELETE da própria sessão e remoção em cascata de suas mensagens; DELETE de outra pessoa deve falhar.
8. **Imutabilidade:** authenticated não pode atualizar ou excluir mensagens individualmente nem atualizar sessões.
9. **Regressão:** Journey, Agenda, Finance e login permanecem funcionais.
10. **Custo e publicação:** não promover para PROD sem resultados registrados, revisão de RLS e aprovação de release.

## Evidências a registrar
- Data/hora, commit e deployment Preview.
- Projeto Supabase de homologação e versão de migração.
- Resultado de cada teste (PASS/FAIL), logs sem dados pessoais e responsável.
- Parecer final de segurança, regressão e decisão de publicação.

## Bloqueio conhecido (12/11/2026)
As branches Supabase `myryra-mvp1-event-homolog` e `myryra-mvp2-finance-homolog` estão com `MIGRATIONS_FAILED`. A segunda não possui `myryra_journeys`. Não usar reset/rebase sem avaliar os dados e migrações específicas existentes.

## Bloqueio adicional de integridade das respostas (12/11/2026)
O SQL atual concede INSERT de mensagens ao papel `authenticated`, com RLS verificando apenas dono da sessão e status ativo. Como a coluna `role` aceita `assistant`, o titular da sessão pode enviar diretamente à Data API uma mensagem falsificada como resposta da MIKA. Isso não permite acesso a outros usuários, mas compromete a autenticidade do histórico e qualquer avaliação futura.

**Bloqueio de release:** antes da publicação, separar mensagens do usuário das respostas produzidas pelo servidor (por exemplo, escrita de respostas da MIKA via caminho confiável e autorização explícita), testar que INSERT direto com `role='assistant'` é rejeitado e preservar a gravação atômica do par pergunta/resposta. Não usar esse histórico para notas ou recompensas até resolver.
