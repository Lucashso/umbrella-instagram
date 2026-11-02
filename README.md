# umbrella-instagram

Post diário no Instagram `@umbrella.crm`, na sequência **dor → CRM resolve → dica de venda**, com o mesmo assunto nos três dias.

- **7h (Brasília):** `gerar.yml` escreve o texto, monta a arte em JPEG e envia para o Telegram com o botão de veto.
- **11h30:** `publicar.yml` publica, a menos que o post tenha sido vetado.
- Só post publicado avança a sequência. Dia vetado ou com falha repete a mesma etapa.

## Travas

| Variável do repositório | Efeito |
|---|---|
| `ATIVO=sim` | Liga os agendamentos. Sem ela, nada roda. |
| `PUBLICAR_DE_VERDADE=sim` | Permite publicar. Sem ela, o fluxo roda até o fim e só simula a publicação. |

## Segredos

`ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `BLOB_READ_WRITE_TOKEN`, `IG_USER_ID`, `IG_ACCESS_TOKEN`, `IG_TOKEN_KEY`.

O bot do Telegram precisa ser exclusivo e sem webhook, porque o veto é lido por `getUpdates`. O token do Instagram vale 60 dias: é renovado a cada 30 e guardado cifrado em `estado/token.enc`.

## O que o conteúdo pode dizer

`conteudo/temas.json` é a lista fechada de assuntos e recursos do produto; o redator só pode afirmar o que está lá. Para falar de algo novo, acrescente um tema. `src/validar.js` recusa percentuais, valores, promessas, superlativos e nomes de seguradoras.

## Rodar localmente

```powershell
npm ci
npm test
$env:CHROME_PATH = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
npm run previa   # gera exemplos em saida/ sem chamar nenhuma API
```
