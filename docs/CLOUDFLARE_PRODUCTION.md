# ED & DU — Cloudflare Production

## Fonte de publicação
- Projeto Pages: `ed-du-terapia-da-beleza`
- Branch oficial: `cloudflare-production`
- Aplicação: V33.0.0
- Banco e autenticação: Neon
- Interface aprovada: fonte visual imutável

## Regra de implantação
O Cloudflare Pages publica somente a branch oficial. Os blocos funcionais são incorporados à aplicação existente sem reconstruir ou alterar o layout aprovado.

## Pagamentos
As integrações de pagamento serão implementadas nos blocos correspondentes usando apenas credenciais de backend/ambiente. Nenhum segredo de gateway pode ser colocado no frontend ou no repositório.

## Domínio
Domínios oficiais:
- `ededuterapiadabeleza.online`
- `www.ededuterapiadabeleza.online`

## Validação
Antes de considerar um bloco concluído:
1. typecheck;
2. testes;
3. build;
4. publicação;
5. teste funcional em produção;
6. confirmação de que a interface visual permaneceu inalterada.

## Segurança
Neon é a única autoridade de autenticação e dados da aplicação. Não há integração ativa com outro provedor de autenticação ou banco.
