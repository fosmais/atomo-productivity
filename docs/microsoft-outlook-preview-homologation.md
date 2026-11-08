# Microsoft Outlook — homologação MYRYRA MVP2

## Estado
Implementação em branch `feat/myryra-mvp1-billing-foundation`, não liberada em produção. A API lê apenas compromissos dos próximos 30 dias, sem criar, editar ou excluir eventos. A tabela `microsoft_connections` precisa ser migrada no banco de **teste** antes de habilitar a integração.

## Microsoft Entra (ação do administrador)
1. Em **Microsoft Entra admin center → App registrations → New registration**, registrar aplicação web MYRYRA Preview.
2. Escolher os tipos de contas permitidos de acordo com o público desejado; o código atual usa endpoint `common`, exigindo configuração compatível com contas organizacionais e pessoais, se ambas forem desejadas.
3. Cadastrar **Web redirect URI** exata: `https://<dominio-preview-estavel>/api/microsoft/callback`. Usar domínio de Preview estável, não URLs efêmeras de cada commit. A implementação compara origem e caminho do callback.
4. Em **API permissions → Microsoft Graph → Delegated**, conceder apenas `Calendars.Read`. `openid` e `offline_access` são solicitados no fluxo OAuth. Não habilitar permissões de e-mail ou acesso de aplicação.
5. Criar um client secret com expiração controlada. Guardar seu valor **somente** no gerenciador de segredos/Vercel, nunca em GitHub ou no chat.

## Vercel Preview (não publicar valores)
- `MICROSOFT_CLIENT_ID`: Application (client) ID do registro.
- `MICROSOFT_CLIENT_SECRET`: segredo criado no Entra.
- `MICROSOFT_REDIRECT_URI`: URI HTTPS exata registrada no Entra.
- `MICROSOFT_TOKEN_ENCRYPTION_KEY`: chave aleatória de 32 bytes codificada em Base64; guardar de modo persistente, com plano de rotação.
- `MICROSOFT_INTEGRATION_ENABLED`: manter `false` até a migração e os testes; habilitar `true` **apenas no Preview** quando tudo estiver pronto.

**Não** copiar esses segredos para Production. Se houver múltiplos projetos Vercel, verificar o projeto correto antes de configurar.

## Checklist de homologação
- [ ] Migração `20261108190000_microsoft_connections.sql` aplicada em banco isolado; RLS e revogações verificadas.
- [ ] Login com conta Microsoft de teste; consentimento explícito `Calendars.Read`; rejeição de state inválido.
- [ ] MFA MYRYRA exigido conforme política; cookies de estado expirados e invalidados.
- [ ] Consulta de calendário retorna compromissos esperados; paginação e limites funcionam.
- [ ] Renovação de access token e refresh token testada; reautorização após revogação.
- [ ] Desconexão elimina tokens armazenados; tentativa de acesso por outro usuário negada.
- [ ] Eventos de outros usuários não aparecem; nenhum token em logs ou respostas.
- [ ] Testes de integração e build completos aprovados.
- [ ] Interface em mobile testada, inclusive estados sem conexão e erro.
- [ ] Acesso real a contas externas permanece somente leitura.

## Limites atuais
Não há importação automática de compromissos Outlook, sincronização bidirecional ou acesso Microsoft To Do. A desconexão elimina credenciais na MYRYRA; **não** revoga necessariamente o consentimento no portal Microsoft. Para revogar permissões externas, o usuário deve gerenciar os aplicativos autorizados em sua conta Microsoft.

## Próximo incremento
Após homologar o calendário, implementar seleção de compromissos para importação confirmada pelo usuário, evitando duplicatas por identificador de origem. Qualquer ação futura de escrita exigirá nova autorização granular e escopos mínimos.
