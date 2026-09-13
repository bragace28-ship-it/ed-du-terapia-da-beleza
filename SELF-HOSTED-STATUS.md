# ED & DU — Self-Hosted Migration Status

## Objetivo
Executar o ED & DU sem Vercel como runtime e sem Supabase Cloud como runtime, preservando banco, Auth, Storage, Edge Functions, comandas, financeiro e gateways.

## Arquitetura alvo
- Nginx + frontend Vite
- Supabase self-hosted/local para Postgres, Auth, Storage, API e Functions
- Docker Compose como orquestração
- PagBank para Pix
- Gateway escolhido pelo profissional para cartão: PagBank, Stripe ou Asaas
- PicPay permanece preparado para fase futura
- InfinitePay permanece fora do projeto

## Trabalho concluído sem ação do usuário
- [x] Fundação Vite/Node
- [x] Dockerfile/Nginx
- [x] Docker Compose inicial
- [x] CI de build frontend
- [x] CI de build Docker
- [x] Preflight e smoke-test local
- [x] Script de exportação controlada do Supabase Cloud
- [x] Verificação de backup por tamanho e SHA-256
- [x] Configuração local das 7 Edge Functions conhecidas e seus modos JWT
- [x] Preflight de segredos
- [x] Inventário das migrations versionadas no Git
- [x] Regra explícita de não destruição do Cloud

## O que ainda depende do ambiente do usuário
- [ ] Executar o export real do Cloud e produzir os dumps
- [ ] Baixar as Edge Functions reais do Cloud
- [ ] Restaurar schema/dados no Docker local
- [ ] Migrar usuários Auth e objetos Storage
- [ ] Configurar secrets reais fora do Git
- [ ] Subir o stack Supabase local/self-hosted completo
- [ ] Executar testes CRUD contra banco restaurado
- [ ] Executar testes de pagamento sandbox
- [ ] Testar webhooks/idempotência com endpoints acessíveis aos provedores
- [ ] Hardening final de RLS/SECURITY DEFINER/search_path após importar o schema real
- [ ] E2E completo e homologação
- [ ] Corte definitivo do Cloud

## Ponto de parada seguro
A próxima ação exige acesso ao ambiente que possui Docker + credenciais do projeto Supabase. O repositório já contém os scripts para executar a etapa de exportação sem apagar ou resetar o Cloud.

### Comando de entrada
```powershell
..\u\scripts\cloud-export.ps1
```

Depois do export, o fluxo será:
1. revisar `backup/cloud-export/`;
2. restaurar em ambiente local;
3. baixar/validar Functions;
4. subir Supabase local;
5. rodar CRUD/E2E/pagamentos;
6. só então preparar o corte.

## Regra de segurança
Nunca executar `supabase db reset` destrutivamente sobre o projeto Cloud e nunca apagar o Cloud antes de possuir backup verificável, restauração local validada e homologação completa.
