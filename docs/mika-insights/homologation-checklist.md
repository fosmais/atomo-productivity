# MIKA Insights — homologação MVP2

Ambiente: Preview da branch `feat/mika-insights-mvp2` conectado exclusivamente ao Supabase de homologação `xanavauqzsrgvdfhcrsm`.

## Pré-condições
- Login de duas contas de teste distintas no Preview.
- `OPENAI_API_KEY` configurada para Preview.
- Nunca usar dados de produção ou pagamentos reais.
- A tabela `public.mika_ideas` deve ter RLS habilitada.

## Cenários de aceite (marcar somente após execução)
- [ ] Conta A registra ideia; data/hora e conteúdo persistem após recarregar.
- [ ] Conta A pesquisa, edita, arquiva, restaura e exclui a ideia.
- [ ] Ao editar/arquivar/restaurar/excluir, sugestão anterior deixa de aparecer.
- [ ] Conta A solicita plano; até oito sugestões são exibidas, sem criar tarefas.
- [ ] Falha de IA retorna erro compreensível e não altera ideias.
- [ ] Conta B não visualiza nem altera as ideias da conta A.
- [ ] POST sem login em `/api/mika-insights/suggest` com UUID válido retorna HTTP 401.
- [ ] POST com login B e UUID de ideia da conta A retorna HTTP 404, sem conteúdo.
- [ ] POST com `ideaId` inválido retorna HTTP 400.
- [ ] POST com Content-Type diferente de JSON retorna HTTP 415.
- [ ] Verificar comportamento no Android e em tela estreita.
- [ ] Conferir logs de Preview após os testes, sem dados sensíveis.

## Voz — cenários adicionais
- [ ] Gravar uma ideia curta em português; confirmar que a transcrição aparece antes de salvar.
- [ ] Editar a transcrição, salvar e confirmar `source = voice` e persistência após recarregar.
- [ ] Negar permissão de microfone; confirmar erro compreensível e possibilidade de digitar.
- [ ] Parar a gravação manualmente e confirmar liberação do microfone.
- [ ] Deixar a gravação atingir 60 segundos; confirmar parada automática.
- [ ] Enviar áudio acima de 10 MB; confirmar bloqueio sem chamada de transcrição.
- [ ] Testar áudio vazio e formato não suportado; confirmar mensagens adequadas.
- [ ] Testar transcrição com texto total acima de 10.000 caracteres; confirmar bloqueio.
- [ ] Abrir a página em Android e validar permissões, formato do áudio e transcrição.
- [ ] Confirmar que áudio não é salvo na tabela de ideias; apenas texto revisado é persistido.

## Comportamento esperado
A geração é apenas uma proposta efêmera, não grava `proposed_plan`, não cria tarefas, não agenda compromissos e não altera a Journey. A aprovação/execução de um plano exige uma futura implementação específica e autorização explícita do usuário.

## Evidências
Registrar aqui: data, commit, deployment, conta de teste pseudonimizada, resultado de cada cenário e defeitos identificados. **Build READY não substitui teste funcional.**

## Liberação
Não realizar merge na `main` nem publicar em produção enquanto cenários críticos não estiverem aprovados.
