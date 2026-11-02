# Master V46 — auditoria complementar de prontidão

Data: 16/10/2026
Branch: `audit/master-v46-fail-closed`
PR draft: https://github.com/bragace28-ship-it/ed-du-terapia-da-beleza/pull/17

## Alterações desta etapa

- `master/runtime-real-checkout.js`: fallback seguro para mensagens de erro e para a exibição de parcelas, evitando interpolar `undefined` quando a resposta ou o campo não existe.
- `master/runtime-functional-hotfix.js`, `master/runtime-navigation-bridge.js`, `master/runtime-navigation-hardening.js`, `master/runtime-homologation.js`: mensagens de erro amigáveis quando a exceção não contém `message`.
- `functions/api/payments.js`: corrigidos 18 parâmetros SQL que estavam escapados como `\${...}` e, portanto, não eram interpolados como parâmetros Neon; protegido o caminho NuPay contra comanda divergente, reprocessamento e baixa prematura em pagamento parcial.
- `functions/api/webhooks/pagbank.js`: resposta idempotente para pagamentos já liquidados e verificação do total da comanda antes do fechamento.
- `functions/api/webhooks/nubank.js`: callback bloqueado sem `NUPAY_WEBHOOK_TOKEN`, validação de referência e retorno idempotente para pagamento já liquidado; os parâmetros SQL foram corrigidos.
- `functions/api/gift-cards/bulk-test.js`: novo endpoint sequencial de envio em massa exclusivo de sandbox, com allowlist de destinatários, token obrigatório, limite de 50 por lote, código idempotente por lote/destinatário e status individual persistido no Neon.
- `master/runtime-homologation.js`: interface de homologação para lote de gift cards que chama o endpoint e mostra o resultado individual, com proteção contra clique duplo.
- `.github/workflows/production-qa.yml`: etapas que modificam Cloudflare, segredos ou produção agora só executam em `push` para `main`; pull requests e branches de auditoria não devem publicar nem apagar deployments.

## Achado importante sobre `undefined`
A busca estática nos runtimes não encontrou a palavra `undefined` usada diretamente como texto fixo de mensagem. Foram encontrados pontos que concatenavam `e.message`/`err.message` sem fallback e um campo opcional de parcelas que podia renderizar `undefinedx`; esses pontos foram ajustados. Isso reduz os caminhos conhecidos, mas não prova que toda ocorrência visual foi eliminada: o artefato `master/index.html` não foi disponibilizado pelo conector de leitura como texto e a origem exata de um erro observado em execução exige reproduzir o evento e obter stack trace/console. Não declarar esse defeito encerrado sem essa evidência.

## Bloqueios para produção

1. Não foi possível executar `node --check`, testes automatizados de integração ou CI nesta sessão. O clone do repositório também falhou por indisponibilidade de DNS; o estado da PR não fornece evidência de execução concluída. As alterações ainda precisam passar por compilação e testes.
2. O envio em massa só funcionará quando os secrets `GIFT_CARD_ENV=sandbox`, `GIFT_CARD_BULK_TEST_TOKEN`, `GIFT_CARD_TEST_RECIPIENTS`, `GIFT_CARD_TEST_DELIVERY_URL` (HTTPS de sandbox/staging) e `GIFT_CARD_TEST_DELIVERY_TOKEN` estiverem configurados no ambiente de homologação. O endpoint recusa ambientes diferentes de sandbox e destinatários fora da allowlist.
3. O callback NuPay exige `NUPAY_WEBHOOK_TOKEN`. A compatibilidade dessa autenticação com o mecanismo de callback configurado no provedor ainda não foi comprovada; se o provedor não enviar esse header, o endpoint recusará o evento e o contrato do webhook deverá ser ajustado com autenticação compatível, sem remover a validação.
4. Os webhooks ainda precisam de teste concorrente/replay contra banco de homologação. Guardas de estado no código não substituem uma prova transacional de idempotência concorrente.
5. PagBank, NuPay, Asaas, Stripe e PicPay precisam de eventos reais de sandbox (sucesso, pendente, recusa, cancelamento, assinatura inválida, repetição e pagamento parcial). Nenhuma cobrança real deve ser disparada para provar isso.
6. OCR exige PDF.js/Tesseract disponíveis no runtime e testes com PDF textual, PDF digitalizado, imagem ruim, campos ausentes e valores ambíguos. A rotina bloqueia se os motores não estiverem carregados.
7. A matriz de 86 funcionalidades ainda não tem evidência individual de execução. Não declarar 86/86 aprovadas apenas por análise estática.
8. O `FINAL_HOMOLOGATION_GATE.json` deve permanecer com `production=false` e `production_release=blocked_until_e2e` até que todos os itens acima passem.

## Decisão de prontidão

**NÃO APROVADO PARA MERGE/PRODUÇÃO NESTE MOMENTO.** A branch contém correções e reforços relevantes, mas não há evidência de compilação/testes E2E bem-sucedidos nem homologação integral das 86 funcionalidades. Manter a PR em draft e a `main`/produção intactas até concluir os gates e registrar resultados verificáveis.


## Retomada técnica — 31/10/2026

- A `main` atual foi preservada como base; `master/runtime-render-guard.js` e sua validação em `scripts/master-check.mjs` permanecem presentes.
- O primeiro CI da retomada detectou `ETARGET` porque `@neondatabase/neon-js@0.1.0` não existe no registry. A dependência foi corrigida para a versão publicada `0.9.0-beta`; a recompilação e os testes precisam ser repetidos antes de qualquer merge.
- Produção responde em `/api/health` e identifica `46.0.0`, mas a inspeção do Neon encontrou zero clientes, profissionais, serviços, agendamentos, comandas, configurações de gateway e credenciais de PIN financeiro. Não considerar dados exibidos pela interface como persistidos sem confirmar as respectivas linhas no banco.
- A verificação visual pública não encontrou `undefined` na tela inicial e abriu a Agenda, porém a Agenda exibiu dois atendimentos enquanto a tabela `appointments` estava vazia; portanto, esses itens não são evidência de persistência real.
- Nenhum deployment foi feito nesta retomada. A PR permanece em draft e as etapas mutáveis de Cloudflare estão limitadas a push na `main`.


## Retomada técnica — 02/11/2026

Branch: `audit/master-v46-rebase-20261031`  
PR: https://github.com/bragace28-ship-it/ed-du-terapia-da-beleza/pull/19  
Commit homologado: `18818408244d1700210fc83f8e7185d92429bffb`

### Correções aplicadas nesta retomada

- Agendamento: removido o campo `source` que não existe no schema; status de interface mapeados para `requested`/`confirmed`; payload preserva `client_id`, `professional_id` e `service_id`.
- Bloqueio de agenda: sincronização de `agenda_blocks` implementada no bridge, com leitura normalizada e intervalo de dia inteiro de meia-noite a meia-noite.
- Produção: o bloqueio de dia inteiro do guard usa intervalo exclusivo até a meia-noite seguinte; ações locais de cupom, fatura, pagamento de teste, exportação financeira e assinatura/envio de termo não informam sucesso sem persistência.
- Agendamento: removidos valores fixos de cliente/profissional/serviço do fluxo de homologação; produção direciona para o formulário seguro da Agenda.
- Regressão: build verifica payload, status, relacionamento de serviço, sincronização de bloqueios e ações locais desabilitadas em produção.

### Evidência executada

- `MASTER CHECK`: PASS — 19 scripts HTML, 9 módulos runtime, 4 módulos API e matriz estrutural com 86 IDs.
- `Master V46 Browser E2E`: PASS — 6/6 testes em 02/11/2026. Os testes novos cobrem payload de agendamento, bloqueio de dia inteiro (inclusive leitura após gravação) e ausência de dados fictícios na tela de agendamento. **O Data API foi simulado nos testes de navegador; isso valida o contrato do frontend, não uma sessão autenticada real.**
- `ED DU Production QA`: PASS — build/QA estático, inventário runtime, deploy Cloudflare isolado e `/api/health` com `ok=true` e `reachable=true`.
- O endpoint de homologação Cloudflare usa a branch Neon isolada `br-broad-frog-b4re07y4`, compute `ep-frosty-pond-b42j28j0`; não é a branch de produção.
- Na branch isolada: RLS habilitado em `appointments`, `agenda_blocks`, `app_users` e `finance_pin_credentials`; `appointments` e `agenda_blocks` possuem política `ALL` para staff; `app_users` possui gestão admin e leitura própria; `finance_pin_credentials` não possui políticas nem privilégios de tabela para `authenticated`. O check constraint de status aceita `requested`, `confirmed`, `rescheduled`, `in_progress`, `completed`, `cancelled` e `no_show`.

### Bloqueios que permanecem

1. Produção: RLS segue desabilitado em `app_users` e `finance_pin_credentials`, e o role `authenticated` mantém privilégios de tabela. A tabela de credenciais PIN está vazia no momento. A migração `005_master_v46_auth_rls_hardening.sql` está versionada e validada apenas na branch isolada; **não foi aplicada em produção**.
2. Produção: `appointments.service_id` ainda não existe no schema de produção. A migração `007_master_v46_appointments_service_fk.sql` foi aplicada/validada apenas no ambiente isolado.
3. Falta E2E com sessão Neon Auth real: autenticar com usuário autorizado, criar agendamento, confirmar a linha em `appointments`, reler na Agenda e validar RLS com usuário sem permissão.
4. Gate de gateway: faltam eventos reais de sandbox para sucesso, pendente, recusa, cancelamento, assinatura inválida, replay e pagamento parcial.
5. A matriz de 86 itens permanece sem evidência individual completa. Os seis testes de navegador não equivalem a 86/86.

### Decisão

**PR continua em draft. Não aprovado para merge/produção.** Não foi executada migração no banco de produção, não foi criada cobrança real e não houve deploy de produção. A próxima etapa deve ser E2E autenticado na branch isolada; depois, autorização explícita e plano de aplicação das migrações `005` e `007` em produção.
