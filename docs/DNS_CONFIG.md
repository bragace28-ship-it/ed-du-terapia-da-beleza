# ED & DU V33 — DNS do domínio personalizado

Domínio: `ededuterapiadabeleza.online`
Cloudflare Pages: `ed-du-terapia-da-beleza.pages.dev`

## Objetivo

Conectar o domínio personalizado ao projeto Cloudflare Pages e retirar o tráfego do site antigo/Wix.

> **Importante:** não altere os nameservers do domínio nesta etapa se eles já estiverem delegados ao Cloudflare. Faça somente os ajustes de DNS necessários e cadastre o domínio no projeto Pages.

## Registros DNS

### `www`

Criar/ajustar:

| Tipo | Nome | Destino | Proxy |
|---|---|---|---|
| CNAME | `www` | `ed-du-terapia-da-beleza.pages.dev` | Proxied/Auto |

### Raiz (`@`)

A forma recomendada para um domínio raiz em Cloudflare Pages é adicionar o domínio personalizado dentro do projeto Pages e deixar o Cloudflare gerenciar o vínculo/flattening necessário.

Se o provedor DNS exigir um registro explícito, use o mecanismo de CNAME flattening/alias disponível no próprio Cloudflare para:

| Tipo | Nome | Destino |
|---|---|---|
| CNAME/Flattened | `@` | `ed-du-terapia-da-beleza.pages.dev` |

**Não crie um A record arbitrário com um IP do Pages.** Se o provedor não suportar CNAME no apex, configure o domínio no Cloudflare Pages e siga a validação indicada pelo Cloudflare.

## Limpeza do Wix

Depois de confirmar que os registros acima estão sendo usados pelo domínio, remova ou substitua registros antigos que apontem para Wix. Não remova registros de e-mail (`MX`, SPF, DKIM/DMARC) se eles forem usados por caixas de e-mail do domínio.

## Validação

Após a propagação:

1. `https://www.ededuterapiadabeleza.online/` deve abrir o ED & DU V33.
2. `https://ededuterapiadabeleza.online/` deve abrir o ED & DU V33.
3. O projeto Pages deve mostrar o domínio personalizado como ativo/verified.
4. `https://ed-du-terapia-da-beleza.pages.dev/version.json` deve retornar `version` `33.0.0` e um commit igual ou posterior ao deploy atual.

## Aviso durante a transição

A aplicação V33 possui uma verificação de origem na inicialização. Se for aberta em `ededuterapiadabeleza.online` enquanto o DNS ainda estiver apontando para o site antigo, a aplicação pode orientar que o domínio está em transição. Isso evita interpretar uma página do provedor antigo como se fosse a aplicação V33.

## Supabase Auth

Depois que o domínio estiver ativo no Pages, confirme no Supabase Auth que o Site URL e os Redirect URLs incluem:

- `https://ededuterapiadabeleza.online/**`
- `https://www.ededuterapiadabeleza.online/**`
- `https://ed-du-terapia-da-beleza.pages.dev/**`
- `http://localhost:5173/**`

Não coloque chaves secretas neste documento.
