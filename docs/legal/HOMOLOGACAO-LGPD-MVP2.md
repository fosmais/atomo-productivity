# MYRYRA MVP2 — Plano de homologação LGPD (Preview)

**Situação:** checklist operacional, não constitui parecer jurídico nem autorização para ativar o bloqueio.
**Empresa nos documentos:** MYRYRA DESENVOLVIMENTO DE SOFTWARE (sem CNPJ até formalização).

## Pré-condições obrigatórias

- [ ] Revisão jurídica dos Termos de Uso e Aviso de Privacidade concluída.
- [ ] URLs públicas estáveis com versão integral de cada documento.
- [ ] Registro de ambas as versões com hash, data de publicação, vigência e status published.
- [ ] Verificar que os textos apresentados correspondem aos hashes cadastrados.
- [ ] Criar usuários de teste específicos, sem modificar aceites de usuários reais.
- [ ] Verificar cobertura de **todas** as rotas privadas e APIs; até agora apenas Dashboard e API de tarefas usam o verificador compartilhado.
- [ ] Executar homologação em Preview antes de habilitar MYRYRA_LEGAL_CONSENT_GATE_ENABLED.

## Matriz de testes

| Caso | Ação | Resultado esperado |
| --- | --- | --- |
| Sem sessão | Consultar status ou enviar aceite | HTTP 401; nenhum registro criado |
| Sem documentos publicados | Consultar status | HTTP 503, sem aceite presumido |
| Ambos publicados e usuário novo | Consultar status | Duas versões vigentes, acceptanceRequired=true |
| Confirmação ausente | POST /api/legal/accept sem accepted=true | HTTP 400; nenhum registro |
| Versão desatualizada | POST com versão antiga | HTTP 409; nenhum aceite da versão nova |
| Formato inválido | POST não JSON | HTTP 415 |
| Corpo excessivo | POST com mais de 8192 bytes | HTTP 413 |
| Primeiro aceite | Confirmar explicitamente ambas versões | Dois registros vinculados ao usuário e versões vigentes |
| Reenvio | Repetir aceite das mesmas versões | Sem novos registros para versões já aceitas |
| Aceite parcial existente | Abrir /legal/consent | Solicitar somente documento ainda pendente |
| Mudança de versão | Publicar nova versão após aceite anterior | Solicitar confirmação da nova versão, sem reutilizar checkbox |
| Acesso ao Dashboard sem aceite | Ativar flag somente no Preview com documentos aprovados | Redirecionar para /legal/consent |
| Acesso à API de tarefas sem aceite | Ativar flag somente no Preview | HTTP 403, sem execução da operação |
| Falha do banco com flag ativa | Simular indisponibilidade | Falhar fechado, não autorizar operação |
| Contas antigas | Acessar com conta de teste pré-existente | Exigir confirmação sem registrar aceite automático |
| MFA | Conta que exige segundo fator | MFA permanece obrigatório; LGPD não o substitui |

## Critérios de liberação

1. Aprovação jurídica e URLs publicadas, verificadas manualmente.
2. Todas as rotas privadas e integrações críticas cobertas por controle de aceite, sem bloquear login, leitura de documentos ou suporte necessário ao consentimento.
3. Evidência de testes com usuário novo e usuário antigo; conferir logs e registros no Supabase.
4. Plano de rollback da flag e observabilidade de erros 403/503.
5. Aprovação explícita para rollout em produção; pagamentos reais continuam independentes e desabilitados até aprovação específica.

**Proibido:** inserir aceites para contas reais, publicar minutas não revisadas ou habilitar cobrança real como parte da homologação LGPD.
