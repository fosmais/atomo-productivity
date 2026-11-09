# MYRYRA MVP2 — Homologação funcional AutoPilot / MIKA Agente

## Objetivo e limites

Validar reservas de foco com duas contas **exclusivas de teste**, em ambiente isolado de homologação. As verificações estáticas e a CI **não** demonstram isolamento de sessões, concorrência real ou autorização de ações externas. Não executar estes cenários com dados de clientes nem usar contas de produção.

## Pré-requisitos (bloqueantes)

- [ ] Ambiente Supabase de teste independente, com migrações sincronizadas e sem dados reais.
- [ ] Duas contas distintas de teste (A e B) com sessões autenticadas reais; não utilizar service-role nas chamadas sob teste.
- [ ] Confirmar RLS ativo em `public.tasks` e `public.events` e função `public.reserve_autopilot_task` com `SECURITY INVOKER`.
- [ ] Executar cada cenário com fixtures novas (tarefas, eventos e horários futuros), registrar IDs e limpar os dados ao final.
- [ ] Capturar respostas HTTP/RPC, registros de banco e logs sem armazenar tokens, e-mails ou dados pessoais nos artefatos.
- [ ] Garantir que a interface apresenta confirmação explícita antes da mutação. Cancelar não deve gerar evento.

## Cenários de aceitação

| ID | Cenário | Procedimento | Resultado esperado |
| --- | --- | --- | --- |
| AF-01 | Propriedade | Sessão B tenta reservar UUID de tarefa pertencente a A | Rejeição, nenhum evento criado |
| AF-02 | Sem autenticação | Chamar RPC sem sessão | Rejeição, nenhum evento criado |
| AF-03 | Concorrência | Duas chamadas simultâneas de A para a mesma tarefa e horário | Uma única reserva persistida, outra rejeitada |
| AF-04 | Conflito de agenda | A reserva tarefa em intervalo que intercepta evento bloqueante existente | Rejeição, agenda inalterada |
| AF-05 | Horários adjacentes | A reserva em intervalo que começa exatamente ao fim de outro evento | Permitido se demais regras atendidas |
| AF-06 | Tarefa na lixeira | A tenta reservar tarefa com `deleted_at` preenchido | Rejeição, nenhum evento criado |
| AF-07 | Evento na lixeira | A reserva em horário ocupado somente por evento excluído | Permitido se demais regras atendidas |
| AF-08 | Duração alterada | A altera `duration_minutes` antes de confirmar reserva antiga | Rejeição, nenhum evento criado |
| AF-09 | Confirmação | Na UI, cancelar a confirmação antes da chamada de reserva | Nenhuma RPC de escrita enviada |
| AF-10 | Idempotência | Repetir a mesma reserva após sucesso | Nenhum evento duplicado |
| AF-11 | Limites temporais | Reservar no passado, intervalo invertido ou fora da janela permitida | Rejeição, nenhum evento criado |
| AF-12 | Separação entre contas | A e B criam tarefas e reservas independentes | Cada sessão só consulta e altera seus próprios dados |

## Evidências obrigatórias

Para cada cenário, registrar: identificador AF, ambiente, versão da migração, commit, horário UTC, resultado esperado, resultado observado, status aprovado/reprovado, contagem de eventos antes/depois e referência ao log sanitizado. Para AF-03, comprovar as duas requisições realmente concorrentes e o resultado final no banco.

## Critério de liberação

Somente considerar a homologação concluída quando AF-01 a AF-12 estiverem aprovados no ambiente isolado, as esteiras CI estiverem verdes e a revisão de LGPD/consentimento e autorização da MIKA estiver documentada. Integrações externas e execução autônoma de ações **não** são abrangidas por estes testes e exigem homologação própria. A publicação em PROD permanece decisão separada, posterior à aprovação.
