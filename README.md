# ED & DU | Terapia da Beleza

Aplicação web do salão com Supabase como autoridade de produção, controle de acesso por perfil, gestão de comandas e Smart Gateway para pagamentos.

## Produção
A integração de produção é mantida no `index.html`. Os workflows de integração são validação-only para evitar que automações concorrentes reescrevam o arquivo e provoquem deploys desnecessários.
