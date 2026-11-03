// Confere se cada token aponta para o @ esperado. Só lê; não publica nem mostra segredo.
import { contasAtivas, rotulo } from './contas.js';
import { conferirConta, credenciais } from './servicos.js';

for (const conta of contasAtivas()) {
  try {
    const { igId, token } = credenciais(conta);
    await conferirConta(igId, token, conta.usuario);
    console.log(`OK: ${rotulo(conta)}`);
  } catch (erro) {
    process.exitCode = 1;
    console.error(`ERRO em ${rotulo(conta)}: ${erro.message}`);
  }
}
