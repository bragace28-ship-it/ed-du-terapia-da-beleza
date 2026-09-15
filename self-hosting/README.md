# ED & DU — produção em servidor próprio

Esta pasta documenta a arquitetura definitiva do ED & DU sem Vercel e sem depender do Supabase Cloud como infraestrutura de produção.

## Arquitetura

- 1 VPS/servidor online
- Nginx ou Caddy como reverse proxy + HTTPS
- frontend Vite servido pelo próprio servidor
- Supabase self-hosted via Docker Compose no mesmo servidor
- PostgreSQL, Auth, Storage, REST, Realtime e Functions no mesmo stack
- Stripe, PagBank, Asaas e PicPay acessados somente pelo backend/Functions
- domínio próprio apontando para o servidor

O aplicativo continua usando `supabase-js`, mas o endpoint passa a ser `/supabase` no domínio próprio. O arquivo `../eddu-selfhost-config.json` recebe a publishable key gerada pela instalação self-hosted.

## Requisitos do servidor

A documentação oficial recomenda, para o stack self-hosted completo, no mínimo 4 GB RAM, 2 vCPU e 40 GB SSD; 8 GB+ RAM, 4 vCPU e 80 GB+ SSD são recomendados para uma carga pequena/média. A instalação oficial usa Docker. Consulte a documentação atual antes de contratar o VPS.

## Instalação do Supabase self-hosted

No Ubuntu/Debian do servidor:

```bash
curl -fsSL https://supabase.link/setup.sh | sh
cd supabase-project
sh run.sh start
```

Antes de expor o serviço, configurar as URLs de produção, segredos, SMTP e HTTPS. Não usar os valores de exemplo.

## Reverse proxy

O domínio principal deve servir o frontend. O caminho `/supabase` deve encaminhar para o gateway do Supabase self-hosted na porta interna 8000, removendo o prefixo `/supabase` no proxy.

Exemplo conceitual:

```nginx
location /supabase/ {
    proxy_pass http://127.0.0.1:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

A configuração final deve ser validada com o hostname real e com os callbacks do Auth.

## Migração do banco

A restauração deve usar `supabase db dump` do projeto gerenciado, porque o comando aplica filtros específicos do Supabase e evita copiar schemas internos de forma inadequada:

```bash
supabase db dump --db-url "$SOURCE_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$SOURCE_DB_URL" -f schema.sql
supabase db dump --db-url "$SOURCE_DB_URL" -f data.sql --use-copy --data-only
```

Depois, restaurar os três arquivos no PostgreSQL self-hosted. Fazer primeiro em uma instância de homologação e validar tabelas, funções, triggers, RLS, `auth.users`, extensões e contagens de registros.

## Edge Functions

As Functions atuais do projeto precisam ser copiadas para o runtime self-hosted e receber as mesmas credenciais de gateway através do ambiente do servidor. Não colocar segredos no frontend nem em arquivos versionados.

Functions atuais relevantes:

- create-stripe-checkout
- stripe-webhook
- create-pix-charge
- pagbank-webhook
- create-asaas-checkout
- asaas-webhook
- create-picpay-checkout-v2
- picpay-webhook
- picpay-public-config

## Cutover

1. Criar VPS e firewall.
2. Instalar Docker/Supabase self-hosted.
3. Configurar domínio, HTTPS e SMTP.
4. Restaurar banco em homologação.
5. Copiar Storage.
6. Copiar Functions e segredos.
7. Validar Auth e callbacks.
8. Configurar `eddu-selfhost-config.json` com a URL e publishable key do servidor.
9. Testar frontend completo.
10. Testar cada webhook.
11. Fazer uma transação real de baixo valor.
12. Conferir gateway → webhook → banco → comanda → financeiro.
13. Só então retirar o tráfego do Supabase Cloud.

O Supabase Cloud deve permanecer como origem/backup durante a transição e não deve ser apagado antes da validação final.
