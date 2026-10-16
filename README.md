# Gmail Monitor

O serviço captura Gmail e Grafana com Playwright e envia as imagens para a API do WhatsApp configurada no `.env`. A autenticação do WhatsApp usa o token da API remota; este projeto não abre sessão WhatsApp Web.

## Execução sem interface gráfica

O navegador usa o perfil persistente `CHECKPOINT_BROWSER_DATA_DIR` em modo headless. A pasta guarda cookies e outros dados de sessão e recebe permissão `700`, portanto o serviço precisa rodar como o proprietário do perfil.

Confira a sessão do Gmail sem abrir uma janela:

```bash
node src/checkpoint/login.js
```

O comando valida uma sessão já existente; não preenche senha nem contorna MFA, SSO ou verificações do Google. Um perfil vazio não consegue autenticar a interface do Gmail do zero sem uma autorização interativa. Para autenticação sem navegador desde a primeira execução, a alternativa suportada é Google Workspace com delegação de domínio e Gmail API; isso exige trocar a captura visual do Gmail por uma integração de API e autorização do administrador. Uma conta Gmail pessoal não oferece essa delegação.

O Gmail e o Grafana precisam estar autenticados no mesmo perfil persistente. A integração WhatsApp usa `WHATSAPP_API_TOKEN` e a API remota configurada no `.env`; a sessão do WhatsApp fica fora deste projeto.

`CHECKPOINT_BROWSER_HEADLESS=true` mantém a execução do serviço sem interface. Não rode dois Chromes simultaneamente usando o mesmo `CHECKPOINT_BROWSER_DATA_DIR`.
