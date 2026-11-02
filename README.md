# umbrella-instagram

Post diário no Instagram `@umbrella.crm`, na sequência **dor → CRM resolve → dica de venda**, com o mesmo assunto nos três dias. Nada é publicado sem aprovação no Telegram.

## Como funciona

1. **7h (Brasília):** `gerar.yml` escreve o texto, monta a arte em JPEG e envia para o Telegram com os botões Aprovar, Editar e Descartar.
2. **Aprovar:** publica na hora.
3. **Editar:** o bot pergunta o que mudar; a resposta volta como nova versão para aprovar de novo, quantas vezes for preciso. Botões de versões antigas deixam de valer.
4. **Descartar:** no dia seguinte sai um novo post para a mesma etapa.
5. **Sem resposta:** nada é publicado e a sequência para. No dia seguinte o bot lembra do post, em vez de criar outro.

Os botões chegam em `api/telegram.js`, um webhook na Vercel que confere o segredo do Telegram e o dono do chat. Como a arte precisa de navegador, ele dispara `aprovacao.yml` no GitHub Actions, que executa `src/acao.js`.

## Travas

| Variável do repositório | Efeito |
|---|---|
| `ATIVO=sim` | Liga os fluxos. Sem ela, nada roda. |
| `PUBLICAR_DE_VERDADE=sim` | Permite publicar. Sem ela, Aprovar só simula. |

## Segredos

**GitHub:** `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `BLOB_READ_WRITE_TOKEN`, `IG_USER_ID`, `IG_ACCESS_TOKEN`, `IG_TOKEN_KEY`.

**Vercel:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, `GH_DISPATCH_TOKEN` (token do GitHub restrito a este repositório, só com Actions: leitura e escrita).

O token do Instagram vale 60 dias: é renovado a cada 30 e guardado cifrado em `estado/token.enc`.

## O que o conteúdo pode dizer

`conteudo/temas.json` é a lista fechada de assuntos e recursos do produto; o redator só pode afirmar o que está lá. Para falar de algo novo, acrescente um tema. `src/validar.js` recusa percentuais, valores, promessas, superlativos e nomes de seguradoras, inclusive em textos editados.

## Rodar localmente

```powershell
npm ci
npm test
$env:CHROME_PATH = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
npm run previa   # gera exemplos em saida/ sem chamar nenhuma API
```
