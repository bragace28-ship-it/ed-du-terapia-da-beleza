# ED & DU | Terapia da Beleza

Aplicação web do salão com **Neon como autoridade única de produção** para autenticação e dados, controle de acesso por perfil, gestão de comandas e Smart Gateway para pagamentos.

## Produção V33
- Entrypoint efetivo: `index.html`, processado pelo Vite e publicado em `dist/` no Cloudflare Pages.
- Versão canônica: `33.0.0`.
- O script de build remove o identificador visual legado V28 e artefatos de preload CSS obsoletos sem alterar o layout aprovado.
- A camada de dados/autenticação da V33 usa exclusivamente `v68-neon-production-bridge.js`.
- Módulos históricos são tratados como legado e não devem ser adicionados ao stack canônico da V33.

## Bloco 02
- PIN financeiro persistido no Neon em `public.finance_pin_credentials`.
- Validação por funções Neon: `set_finance_pin`, `finance_pin_status` e `verify_finance_pin`.
- PIN não é solicitado em Agenda nem em Comandas.
- Acesso financeiro fica condicionado ao nível de acesso e ao PIN.
- Nenhum CSS, JSX, estilo inline, cor ou posicionamento da interface aprovado é alterado pelo módulo do PIN.
