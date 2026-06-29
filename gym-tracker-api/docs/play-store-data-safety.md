# Play Store Data Safety - GymTracker

Use este arquivo como base para preencher a seção "Data safety" no Google Play Console.

## Dados coletados

- Informações pessoais: e-mail, nome de exibição e foto de perfil opcional.
- Saúde e fitness: exercícios, fichas, séries, cargas, repetições, sessões, frequência, peso corporal e estimativa de calorias.
- Identificadores: identificador interno da conta e tokens de autenticação.

## Finalidade

- Funcionalidade do app.
- Gerenciamento de conta.
- Segurança, prevenção de fraude e autenticação.
- Análise do progresso do usuário dentro do próprio app.

## Compartilhamento

- Não vender dados.
- Não compartilhar dados para publicidade.
- Dados podem ser processados por provedores de infraestrutura usados para hospedar API, banco de dados, frontend e e-mails transacionais.

## Segurança

- Senhas armazenadas com hash.
- Comunicação por HTTPS em produção.
- Acesso aos dados protegido por autenticação da API.

## Exclusão de dados

- Exclusão dentro do app: Perfil > Zona de risco > Excluir Conta.
- Página pública para solicitação: `/delete-account.html`.
- Dados excluídos: conta, e-mail, nome, foto, fichas, exercícios personalizados, histórico de treinos, séries, sessões, peso corporal e tokens de recuperação.

## Antes de publicar

- Substituir `SEU_EMAIL_DE_SUPORTE_AQUI` nas páginas públicas.
- Publicar e informar no Play Console a URL pública de `/privacy.html`.
- Publicar e informar no Play Console a URL pública de `/delete-account.html`.
