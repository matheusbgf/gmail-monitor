# Gmail Monitor

O serviço captura Gmail e Grafana com Playwright e envia as imagens para a API do WhatsApp configurada no `.env`. A autenticação do WhatsApp usa o token da API remota; este projeto não abre sessão WhatsApp Web.

## Chrome visível integrado ao `npm start`

Na máquina desktop, defina `CHECKPOINT_BROWSER_CDP_ENABLED=true` no `.env` local. Ao executar `npm start`, o inicializador abre `google-chrome-stable` com `CHECKPOINT_BROWSER_DATA_DIR`, restringe a porta DevTools à máquina local (`127.0.0.1:9222`) e inicia o monitor conectado a essa mesma sessão. O perfil guarda o login entre execuções.

Se um Chrome já estiver disponível nessa porta, o monitor o reutiliza. Feche qualquer Chrome aberto com o mesmo perfil sem a porta de depuração antes de iniciar o monitor. Ao encerrar `npm start`, o inicializador fecha apenas o Chrome que ele próprio abriu.

A opção CDP fica desativada por padrão para manter o modo headless dos servidores. A porta de depuração concede controle sobre o perfil do navegador e deve permanecer vinculada a `127.0.0.1`.

## Execução sem interface gráfica

O navegador usa o perfil persistente `CHECKPOINT_BROWSER_DATA_DIR` em modo headless. A pasta guarda cookies e outros dados de sessão e recebe permissão `700`, portanto o serviço precisa rodar como o proprietário do perfil.

Confira a sessão do Gmail sem abrir uma janela:

```bash
node src/checkpoint/login.js
```

O comando valida uma sessão já existente; não preenche senha nem contorna MFA, SSO ou verificações do Google. Um perfil vazio não consegue autenticar a interface do Gmail do zero sem uma autorização interativa. Para autenticação sem navegador desde a primeira execução, a alternativa suportada é Google Workspace com delegação de domínio e Gmail API; isso exige trocar a captura visual do Gmail por uma integração de API e autorização do administrador. Uma conta Gmail pessoal não oferece essa delegação.

O Gmail e o Grafana precisam estar autenticados no mesmo perfil persistente. A integração WhatsApp usa `WHATSAPP_API_TOKEN` e a API remota configurada no `.env`; a sessão do WhatsApp fica fora deste projeto.

`CHECKPOINT_BROWSER_HEADLESS=true` mantém o modo padrão sem interface quando CDP está desativado. Não rode dois Chromes simultaneamente usando o mesmo `CHECKPOINT_BROWSER_DATA_DIR`.
