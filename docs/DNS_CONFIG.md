# ED & DU — Domínio personalizado

Domínio: `ededuterapiadabeleza.online`
Cloudflare Pages: `ed-du-terapia-da-beleza.pages.dev`

## Objetivo
Servir a publicação aprovada do ED & DU pelo domínio personalizado e pelo endereço Pages.

## Associação
No projeto Cloudflare Pages `ed-du-terapia-da-beleza`, o domínio personalizado deve estar associado ao projeto:
- `ededuterapiadabeleza.online`
- `www.ededuterapiadabeleza.online`

A ativação do domínio deve ser concluída no próprio Cloudflare Pages.

## DNS
Para `www`, quando necessário:
- CNAME `www` → `ed-du-terapia-da-beleza.pages.dev`

Para o domínio raiz, use a associação de Custom Domain do Cloudflare Pages e o gerenciamento de DNS do Cloudflare. Não aponte o apex para IP arbitrário.

Não altere registros de e-mail (MX/SPF/DKIM/DMARC) usados pelas caixas do domínio.

## Validação
- O domínio raiz e `www` devem servir a publicação aprovada.
- `https://ed-du-terapia-da-beleza.pages.dev/version.json` deve informar V33.0.0 e o commit publicado.
- Não deve haver redirecionamento para outra implementação do aplicativo.

## Regra
Qualquer publicação diferente da branch `cloudflare-production` deve ser tratada como fora da fonte oficial do aplicativo.
