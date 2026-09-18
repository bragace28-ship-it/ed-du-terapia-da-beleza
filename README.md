# ED & DU | Terapia da Beleza

Aplicação web do salão. A publicação ativa é a interface visual aprovada, com Neon como autoridade única para autenticação e dados.

## Fonte única de produção
- Repositório: `bragace28-ship-it/ed-du-terapia-da-beleza`
- Branch de produção: `cloudflare-production`
- Aplicação: V33.0.0
- Banco e autenticação: Neon
- Hospedagem/publicação: Cloudflare Pages
- Não existe integração de produção com provedores ou implementações legadas.

## Regra de implementação
A interface visual aprovada é imutável. Novos blocos entram somente como funcionalidade sobre a interface existente, sem reconstrução, redesign, troca de CSS ou alteração de layout.

## Segurança e dados
- Dados reais vêm exclusivamente do Neon.
- Segredos de gateway permanecem no ambiente de backend.
- Pagamentos confirmados devem usar webhooks idempotentes.
- Agenda e Comandas não usam PIN.
- Financeiro usa PIN na etapa de segurança final.

## Implantação
A cada bloco: validar código → build → QA → publicação → teste funcional. Um bloco só é considerado concluído após validação em produção.
