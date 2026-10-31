# MYRYRA MVP 1 — Release gate de autenticação e dados

Status: **PENDENTE DE HOMOLOGAÇÃO REAL**. Código compilado ou deployment READY não equivale a teste de usuário.

## Preparação
- [ ] Preview Vercel READY no commit candidato e variáveis de ambiente presentes (sem revelar valores).
- [ ] Duas contas de teste distintas, uma com MFA TOTP e outra sem MFA.
- [ ] Dispositivo autenticador principal e um segundo dispositivo independente.
- [ ] Nenhum segredo, código TOTP ou token de sessão registrado em prints/logs.

## Autenticação
- [ ] Cadastro novo exige >=12 caracteres; senha curta recebe mensagem útil.
- [ ] Login de conta antiga funciona sem exigir alteração de senha.
- [ ] Login sem MFA abre dashboard; logout encerra sessão.
- [ ] Login com MFA fica em AAL1 até verificar código e só depois abre dashboard.
- [ ] Atualização de página durante desafio MFA retoma o desafio.
- [ ] Código inválido é rejeitado; código válido permite acesso.
- [ ] Dois fatores verificados: seletor oferece ambos e ambos funcionam.
- [ ] Cancelamento de enrollment remove fator não verificado; nenhum segredo permanece na tela.
- [ ] Recuperação de senha por e-mail funciona com link válido, inválido, expirado e reutilizado.
- [ ] Após redefinir senha, sessão é encerrada e login + MFA são exigidos quando aplicável.
- [ ] Rotas de API sensíveis retornam 401 sem sessão e 403/MFA_REQUIRED quando a sessão precisa de AAL2.

## Supabase — proteção de dados
- [x] Rollback emergencial removeu as políticas MFA que causavam permission denied.
- [x] SELECT sem identidade JWT nas seis tabelas retornou zero linhas sem erro de permissão.
- [ ] AAL1 com MFA cadastrado não consegue ler/gravar dados protegidos pela Data API **diretamente**.
- [ ] AAL2 consegue ler/gravar somente seus próprios dados.
- [ ] Usuário B não consegue ler, editar ou excluir dados do usuário A.
- [ ] Políticas definitivas MFA validadas com permissões reais e rollback antes de produção.
**Bloqueador P0:** a política MFA na Data API ainda não foi restabelecida; não liberar produção com MFA anunciado como proteção integral antes da validação.

## Funcionalidades
- [ ] Criar, editar, concluir e excluir tarefas; sincronização após refresh.
- [ ] Criar e excluir eventos; fuso horário correto e conflitos.
- [ ] Favoritar/desfavoritar tarefa e evento; isolamento entre contas.
- [ ] MYKA responde com OpenAI e rate limiting Upstash configurado.
- [ ] Captura Rápida, Focus Mode, Daily Briefing, What Now e Weekly Intelligence.
- [ ] Fluxos responsivos no desktop e mobile.

## Critério de liberação
Liberar beta somente com todos os itens P0 validados, deployment READY, sem erros críticos de runtime, e testes reais documentados. Não marcar itens como concluídos apenas pela inspeção de código.
