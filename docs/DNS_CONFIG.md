# ED & DU V33 — DNS do domínio personalizado

Domínio: `ededuterapiadabeleza.online`
Cloudflare Pages: `ed-du-terapia-da-beleza.pages.dev`

## Objetivo

Conectar o domínio personalizado ao projeto Cloudflare Pages e retirar o tráfego do site antigo/Wix.

> **Importante:** o domínio precisa primeiro ser associado ao projeto em **Workers & Pages → ed-du-terapia-da-beleza → Custom domains → Set up a domain**. Só apontar um CNAME manualmente, sem associar o domínio ao projeto Pages, pode deixar o hostname sem serviço.

> **Nameservers:** não altere os nameservers nesta etapa se eles já estiverem delegados ao Cloudflare. O domínio apex do Pages exige que a zona esteja no Cloudflare; nesse cenário o Cloudflare pode criar/gerenciar o CNAME necessário para o apex.

## 1. Associar o domínio ao Pages

No projeto `ed-du-terapia-da-beleza`, adicione:

- `ededuterapiadabeleza.online`
- `www.ededuterapiadabeleza.online`

Conclua a ativação/validação do domínio antes de considerar o DNS finalizado.

## 2. Registros DNS

### `www`

Se o Cloudflare não criar o registro automaticamente, criar/ajustar:

| Tipo | Nome | Destino | Proxy |
|---|---|---|---|
| CNAME | `www` | `ed-du-terapia-da-beleza.pages.dev` | Proxied/Auto |

### Raiz (`@`)

Para o apex, **não use um IP arbitrário de Pages**. Com a zona no Cloudflare, CNAME flattening permite que o apex use o destino `ed-du-terapia-da-beleza.pages.dev`; para Pages, o fluxo recomendado é deixar o próprio Cloudflare criar/gerenciar o registro após a associação do custom domain.

| Tipo | Nome | Destino |
|---|---|---|
| CNAME (flattened) | `@` | `ed-du-terapia-da-beleza.pages.dev` |

## 3. Limpeza do Wix

Depois de confirmar que o domínio está ativo no Pages, remova ou substitua os registros antigos que apontem para Wix.

**Não remova** registros de e-mail (`MX`, SPF, DKIM/DMARC) se eles forem usados pelas caixas de e-mail do domínio.

## 4. Validação

Após a propagação:

1. `https://www.ededuterapiadabeleza.online/` deve abrir o ED & DU V33.
2. `https://ededuterapiadabeleza.online/` deve abrir o ED & DU V33.
3. O projeto Pages deve mostrar o domínio personalizado como ativo/verified.
4. `https://ed-du-terapia-da-beleza.pages.dev/version.json` deve retornar `version` `33.0.0` e o commit atual ou posterior.
5. Não deve existir uma página Wix no domínio.

Se o Pages funcionar em `pages.dev` mas o domínio personalizado não funcionar, a investigação deve começar por DNS/custom domain, não pelo código React.

## Aviso durante a transição

A aplicação V33 verifica `/version.json` quando é aberta no domínio personalizado. Se o hostname estiver servindo o provedor antigo, ou uma publicação diferente da V33, a inicialização exibe **“Domínio em transição”** em vez de apresentar a origem antiga como se fosse o aplicativo.

## Supabase Auth

Depois que o domínio estiver ativo no Pages, confirme no Supabase Auth que o Site URL e os Redirect URLs incluem:

- `https://ededuterapiadabeleza.online/**`
- `https://www.ededuterapiadabeleza.online/**`
- `https://ed-du-terapia-da-beleza.pages.dev/**`
- `http://localhost:5173/**`

Não coloque chaves secretas neste documento.
