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
