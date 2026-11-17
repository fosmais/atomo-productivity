# MVP2 — roteiro de homologação HTTP autenticada (P0)

**Ambiente:** somente Vercel Preview apontando para Supabase de homologação. **Nunca executar contra produção.** Antes de iniciar, confirmar no deploy que as variáveis de Supabase apontam para o projeto de homologação e que as migrações da PR #27 estão aplicadas. Não registrar cookies, tokens, respostas pessoais ou chaves em logs e comentários.

## Pré-condições
- Dois usuários de teste distintos (A e B), ambos com aceite legal vigente e MFA conforme a configuração do ambiente.
- Duas sessões autenticadas independentes para A (navegador e aba/perfil separado).
- Jornada de teste A com missão educacional e aula MIKA vinculada; jornada B separada.
- OpenAI disponível em Preview com limites de custo e rate limit. Asaas real desabilitado.
- Capturar HTTP status, IDs sintéticos e evidência anonimizada de saldo MYRA antes/depois.

## Matriz de aceitação

| ID | Ação | Resultado esperado |
| --- | --- | --- |
| H01 | A cria jornada, missão educacional e agenda aula MIKA vinculada | IDs persistidos; sessão referencia jornada/missão de A |
| H02 | B consulta ou tenta vincular aula à missão de A | 403/404; nenhuma alteração |
| H03 | A solicita correção sem salvar resposta | HTTP 409; nenhuma nota gravada |
| H04 | A salva resposta válida e solicita avaliação MIKA | HTTP 200 com `saved:true`, `score` 0–100, `passed` coerente com >=70; nota persistida |
| H05 | A tenta concluir missão vinculada sem nota aprovada | HTTP 409; sem crédito MYRA |
| H06 | Após avaliação aprovada, A conclui a missão | Status completed; exatamente 10 MYRAs |
| H07 | A repete conclusão/reenvia requisição | Nenhum segundo crédito; histórico idempotente |
| H08 | A salva uma resposta **idêntica** durante correção | Não muda revisão; correção em curso não é invalidada apenas pelo reenvio |
| H09 | A altera resposta enquanto a MIKA corrige | Avaliação obsoleta rejeitada (409); nenhuma nota antiga sobre nova resposta |
| H10 | Duas sessões de A alteram a mesma resposta em paralelo | Atualização obsoleta rejeitada (409); sem sobrescrita silenciosa |
| H11 | A edita resposta após avaliação | Nota/feedback anteriores invalidados; missão não pode ser concluída até nova aprovação |
| H12 | B consulta progresso, saldo MYRA ou sessão de A | Nenhum dado de A exposto |
| H13 | A exclui missão/jornada já recompensada | Histórico e saldo MYRA preservados; referências removidas sem quebrar API |
| H14 | Acessar Journey, Agenda, Tarefas e aulas no celular | Menu inferior acessível, ações e feedbacks legíveis, sem rolagem horizontal |
| H15 | Falha simulada na persistência da avaliação | HTTP 503 e `saved:false`; nenhuma conclusão/creditação indevida |
| H16 | Usuário sem aceite legal atual tenta criar aula/avaliar | HTTP 403 `LEGAL_ACCEPTANCE_REQUIRED` quando gate habilitado |

## Critério de liberação
Todos os P0 aprovados com evidências reproduzíveis; sem erros 5xx inesperados, sem vazamento entre usuários, sem crédito duplicado, sem alteração da produção. Validar políticas de avaliação em novas missões e conferir se a classificação educacional não depende apenas do título. Somente depois revisar PR, merge e promoção controlada.

**Estado atual:** testes de contrato, CI e SQL sintético já realizados; este roteiro **não é evidência de E2E executado**. Marcar os cenários apenas após execução autenticada real.
