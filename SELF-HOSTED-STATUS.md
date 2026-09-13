# ED & DU — Self-Hosted Migration Status

## Objetivo
Executar o ED & DU sem Vercel como runtime e sem Supabase Cloud como runtime, preservando o banco, Auth, Storage, Edge Functions, comandas, financeiro e gateways existentes.

## Arquitetura alvo
- Nginx + frontend Vite
- Supabase self-hosted/local para Postgres, Auth, Storage, API e Functions
- Docker Compose como orquestracao
- PagBank para Pix
- Gateway escolhido pelo profissional para cartao: PagBank, Stripe ou Asaas
- PicPay permanece preparado para fase futura
- InfinitePay permanece fora do projeto

## Fases
- [x] Fundacao Vite/Node
- [x] Dockerfile/Nginx
- [x] Docker Compose inicial
- [x] CI de build frontend
- [x] CI de build Docker
- [x] Preflight e smoke-test local
- [ ] Exportacao controlada do Supabase Cloud
- [ ] Migrations completas locais
- [ ] Restore dos dados
- [ ] Auth e Storage
- [ ] Edge Functions locais
- [ ] Secrets locais
- [ ] Testes CRUD
- [ ] Testes de pagamento sandbox
- [ ] Testes de webhooks/idempotencia
- [ ] Hardening RLS/SECURITY DEFINER/search_path
- [ ] Teste end-to-end
- [ ] Homologacao

## Regra de seguranca
Nao executar `supabase db reset` ou apagar o projeto Cloud antes de possuir backup verificavel e teste local aprovado.
