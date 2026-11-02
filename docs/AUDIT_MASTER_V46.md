# Auditoria estrutural Master V46 — revisão de código

## Escopo
Revisão estática do bridge Neon, runtime de agenda, OCR, APIs de pagamento e webhooks. Esta auditoria não substitui testes de execução em ambiente de homologação.

## Alterações desta branch
- `master/neon-live-bridge.js`: erros de leitura/gravação deixam de ser engolidos; conexão só fica `confirmed` após a sincronização das entidades e cache/mapa local. Falhas publicam estado `error`, preservam mensagem diagnóstica e deixam `__EDDU_NEON_CONNECTED=false`. A espera pelo cliente Neon tem timeout. Agendamentos locais sem IDs reais de cliente/profissional/serviço ou com intervalo inválido são rejeitados.
- `master/runtime-functional-hotfix.js`: removidos clientes de demonstração. OCR não interpreta mais o nome do arquivo como se fosse conteúdo. A rotina tenta extrair texto real de PDF via PDF.js ou de imagem via Tesseract, valida valor, CPF/CNPJ, vencimento e descrição, e falha explicitamente quando o motor não está disponível ou os campos são insuficientes.
- `master/runtime-homologation.js`: agendamento requer IDs reais carregados do servidor, valida cliente/profissional/serviço ativos, horário e conflitos, e só mostra sucesso após retorno de inserção com ID do Neon. Não grava agendamento fictício em localStorage como se fosse persistido.
- `functions/api/webhooks/stripe.js` e `functions/api/webhooks/picpay.js`: corrigidos placeholders SQL escapados que impediam a interpolação dos valores; adicionada validação da configuração Neon e resposta idempotente para pagamentos já liquidados.
- `functions/api/webhooks/asaas.js`: comanda não é fechada só porque um evento individual indica pagamento; a soma de pagamentos confirmados deve alcançar o total líquido da comanda.

## Bloqueios ainda existentes
1. OCR real depende de PDF.js/Tesseract estarem carregados pelo frontend. Se não estiverem, o código agora bloqueia o lançamento; a dependência ainda precisa ser empacotada/configurada e testada com PDFs textuais e digitalizados.
2. O fluxo de agendamento deve ser exercitado com sessão Neon Auth real e RLS ativo. A revisão estática não comprova políticas de acesso nem compatibilidade de todos os métodos do cliente Neon Data API.
3. Idempotência concorrente de webhooks precisa de constraint/transação persistente de evento e teste de chamadas paralelas. O retorno duplicado no código reduz reprocessamento, mas não é prova contra corrida concorrente.
4. PicPay/NuPay e todos os gateways exigem homologação com credenciais de sandbox, eventos válidos e inválidos, pagamento pendente, recusa, cancelamento e duplicação.
5. A matriz `master/FEATURE_MATRIX_86.json` ainda não tem evidência individual de execução dos 86 itens. Nenhum item deve ser rotulado como aprovado apenas por existir no código.
6. A interface precisa ser validada sem automação paga, por testes unitários/integração e inspeção manual controlada. O erro visual `undefined` ainda requer rastreamento até o handler que o produz.

## Segurança de publicação
Esta branch é isolada: `audit/master-v46-fail-closed`. As alterações não foram mescladas em `main` nem publicadas no domínio de produção. O gate de produção deve permanecer bloqueado até passar a bateria de testes.

## Critério de aprovação
Para cada item: pré-condições verificadas, operação real executada, resposta de sucesso ou erro verificada, persistência confirmada no Neon, repetição/idempotência testada e evidência registrada. Testes de pagamento e disparo em massa devem usar apenas sandbox e destinatários de teste.
