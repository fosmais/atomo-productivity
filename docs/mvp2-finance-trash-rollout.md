# MYRYRA Finance — lixeira recuperável (MVP2)

## Estado verificado em 07/11/2026

A tabela `public.myryra_finance_entries` contém `id`, `user_id`, `description`, `amount_cents`, `kind` e `created_at`. **Não há coluna de exclusão lógica.** O frontend atual executa `.delete()` definitivo. Não ativar a lixeira apenas pela interface: isso poderia dar falsa impressão de recuperação.

## Implementação segura proposta

1. Adicionar `deleted_at timestamptz null` à tabela, por migração revisada. Confirmar RLS de SELECT/UPDATE por `user_id = auth.uid()` e políticas com `USING` e `WITH CHECK`. Validar em ambiente de teste antes de produção.
2. Alterar leitura e paginação de lançamentos ativos para `deleted_at IS NULL`. O saldo e os totais devem considerar **somente** lançamentos ativos; todas as consultas agregadas, importações e relatórios devem seguir o mesmo filtro.
3. Substituir exclusão definitiva por UPDATE com `deleted_at = now()`, filtro de `id`, `user_id` e `deleted_at IS NULL`; exigir retorno da linha para confirmar sucesso.
4. Adicionar aba “Lixeira” que consulta somente `deleted_at IS NOT NULL`, com botão “Restaurar” usando UPDATE `deleted_at = null`. Exigir confirmação e verificar o resultado no servidor. Evitar exclusão permanente no MVP2.
5. Em falhas de rede, não presumir que a operação falhou nem reexecutar cegamente. Recarregar do servidor para conciliar o estado; não alterar saldo local até confirmação.
6. Testar isolamento entre usuários, paginação, exclusão/restauração repetidas, falhas de rede, saldo negativo, grandes históricos e compatibilidade com dados antigos.

## Critérios de aceite

- Excluir uma despesa reduz as despesas ativas e recalcula o saldo exatamente uma vez.
- Restaurar a mesma despesa devolve o saldo anterior exatamente uma vez.
- Um usuário não pode visualizar ou restaurar registros de outro usuário.
- Uma falha não exibe mensagem falsa de sucesso nem elimina o registro.
- Nenhum lançamento é apagado fisicamente pela ação comum de excluir.
- Sem implantação em produção antes de migração, testes automatizados e homologação ponta a ponta.

**Status:** especificação técnica; migração e lixeira ainda não implementadas.
