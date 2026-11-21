# MIKA Insights — roteiro de homologação autenticada (Preview)

**Escopo:** somente branch `feat/mika-insights-mvp2`, PR #65. Não executar em produção. Não habilitar cobrança nem mesclar na `main`.

## Pré-condições
- Abrir o deployment READY mais recente da branch no celular e no desktop.
- Entrar com uma conta de teste autenticada no Supabase Preview.
- Confirmar que o ambiente usa o projeto Supabase Preview, não PROD.
- Não usar dados pessoais sensíveis nos testes.

## Cenários funcionais (registrar PASS/FAIL, dispositivo, horário e evidência)
1. **Captura:** escrever ideia, salvar, atualizar página; conferir conteúdo e data/hora.
2. **Voz:** permitir microfone, gravar frase curta, parar; conferir transcrição, revisar texto, salvar e atualizar página. Negar microfone e verificar mensagem de erro e alternativa de digitação.
3. **Plano:** solicitar sugestão da MIKA; conferir até 8 ações, prioridades e datas válidas. Antes de clicar em salvar, atualizar página e confirmar que a sugestão não foi persistida automaticamente.
4. **Persistência explícita:** gerar sugestão novamente, clicar em salvar plano na ideia, atualizar página e conferir ações persistidas. Confirmar que nenhuma tarefa foi criada na Agenda.
5. **Edição:** alterar ideia com plano salvo; conferir que o plano anterior é invalidado e pode ser gerado novamente.
6. **Arquivar/restaurar:** arquivar e conferir aba de arquivadas; restaurar e conferir estado e plano salvo, quando aplicável.
7. **Excluir:** confirmar diálogo, excluir, atualizar página e conferir ausência.
8. **Duas sessões:** abrir mesma ideia em duas abas/dispositivos; editar na sessão A e tentar editar, arquivar, restaurar ou excluir com versão antiga na sessão B. Esperado: operação B bloqueada, sem sobrescrever o estado atual.
9. **Isolamento:** com duas contas de teste, confirmar que uma conta não visualiza nem altera ideias da outra.
10. **Mobile:** repetir captura, voz, plano, edição, arquivamento e exclusão em Android; verificar layout, teclado, permissões e navegação.

## APIs e limites (teste autenticado)
- `POST /api/mika-insights/suggest`: UUID inválido (400), ideia de outro usuário (404), arquivada (409), JSON > 4096 bytes (413), limite de quota (429), caso válido (200).
- `POST /api/mika-insights/transcribe`: multipart malformado (400), MIME não permitido (415), áudio > 10 MB (413), payload > 11 MB (413), limite de quota (429), áudio válido (200).
- Sem sessão: ambas as APIs devem responder 401; sem cache de respostas com dados pessoais.

## Evidências e critérios de saída
- Registrar resultado por cenário, versão/commit do deployment e eventuais erros.
- Verificar logs sem expor chaves, áudio ou dados pessoais.
- Revisar avisos do Supabase Security Advisor e permissões das funções privilegiadas.
- Confirmar CI/lint independentemente do build Vercel.
- Só considerar PR pronto para revisão final após todos os cenários P0 passarem.
- Merge e qualquer mudança em produção exigem autorização explícita.
