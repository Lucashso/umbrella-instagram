# umbrella-instagram

Conteúdo diário para quatro perfis do Instagram, com aprovação de todos no mesmo chat do Telegram. Nada é publicado sem aprovação.

| Conta | Perfil | Público | Sequência |
|---|---|---|---|
| `umbrella` | `@umbrella.crm` | Corretores | dor → CRM resolve → dica de venda, com o Umbi |
| `leme` | `@leme.crm` | Corretores | a mesma da Umbrella, com o Timo e a marca Leme CRM |
| `priscilla` | `@freitas.priscilla` | Clientes finais, em primeira pessoa | situação → caminho → dica |
| `arcana` | a definir em `src/contas.js` | Clientes finais, como empresa | situação → caminho → dica |

As configurações ficam em `src/contas.js`. A Leme usa `conteudo/temas.json` com Umbi trocado por Timo e Umbrella CRM por Leme CRM; uma marca nunca passa na validação do post da outra. As contas de cliente usam `conteudo/temas-cliente.json`, sem Umbi e com regras próprias para seguro e consórcio.

## Ligar uma conta nova

1. Confirme o `usuario` da conta em `src/contas.js`; sem ele a conta não liga.
2. Crie os segredos `IG_USER_ID_<CONTA>` e `IG_ACCESS_TOKEN_<CONTA>` no GitHub.
3. Acrescente a conta à variável `CONTAS_ATIVAS` do GitHub e rode o workflow **Conferir contas do Instagram**.
4. Acrescente a conta à variável `CONTAS_ATIVAS` da Vercel e publique o webhook de novo, para os botões de ideia aparecerem.

Antes de cada publicação, o sistema confere se o token aponta para o @ esperado. Se não apontar, nada é publicado.

## Formatos

- **Dor e CRM resolve:** uma imagem, sempre com o Umbi.
- **Dica de venda:** sempre carrossel de 5 slides (capa, 3 passos e encerramento), com o Umbi em todos.
- **Story do Umbi:** 1 por dia, vertical e em primeira pessoa, com deboche. Não fala de morte, doença, acidente ou sinistro.
- **Ideias da social media:** mensagem solta no bot vira ideia, com a escolha entre story e post. O resultado volta para aprovação e não conta na sequência.

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

**GitHub:** `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `BLOB_READ_WRITE_TOKEN`, `IG_USER_ID`, `IG_ACCESS_TOKEN`.

**Vercel:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, `GH_DISPATCH_TOKEN` (token do GitHub restrito a este repositório, só com Actions: leitura e escrita).

O app da Meta usa a API com login unificado (`graph.facebook.com`). O token é de usuário do sistema e o painel indica que não expira; se a Meta passar a recusá-lo, gere outro no painel do app e atualize `IG_ACCESS_TOKEN`.

## Publicar o webhook

Não rode `vercel deploy` na pasta do repositório: o último commit costuma ser do robô da automação e a Vercel bloqueia a publicação. Copie `api`, `public`, `vercel.json`, `package.json`, `.vercelignore` e `.vercel` para uma pasta sem git e rode o deploy com `--cwd`.

## O que o conteúdo pode dizer

`conteudo/temas.json` é a lista fechada de assuntos e recursos do produto; o redator só pode afirmar o que está lá. Para falar de algo novo, acrescente um tema. `src/validar.js` recusa percentuais, valores, promessas, superlativos e nomes de seguradoras, inclusive em textos editados.

## Rodar localmente

```powershell
npm ci
npm test
$env:CHROME_PATH = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
npm run previa   # gera exemplos em saida/ sem chamar nenhuma API
```
