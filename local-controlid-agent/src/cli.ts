import * as dotenv from 'dotenv';
import * as path from 'path';
import * as readline from 'readline';
import { ControlIdClient } from './ControlIdClient';

// Carrega as variáveis do arquivo .env
dotenv.config({ path: path.join(__dirname, '../.env') });

// Desativa o simulador para forçar comunicação real com o hardware
process.env.CONTROLID_SIMULATOR = 'false';

const client = new ControlIdClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function showMenu() {
  console.log('\n\x1b[36m==================================================\x1b[0m');
  console.log('\x1b[1m\x1b[32m     CARRASCO FIT — TERMINAL INTERATIVO CATRACA    \x1b[0m');
  console.log('\x1b[36m==================================================\x1b[0m');
  console.log('Escolha uma opção para testar a comunicação física:\n');
  console.log(' \x1b[33m[1]\x1b[0m 🔍 Rodar Diagnóstico (Verificar se a Catraca está Online)');
  console.log(' \x1b[33m[2]\x1b[0m 🔓 Liberar ENTRADA (Sentido Horário)');
  console.log(' \x1b[33m[3]\x1b[0m 🔓 Liberar SAÍDA (Sentido Anti-horário)');
  console.log(' \x1b[31m[q]\x1b[0m ❌ Sair do Terminal');
  console.log('\x1b[36m--------------------------------------------------\x1b[0m');
  rl.question('\nDigite sua opção: ', handleInput);
}

async function handleInput(input: string) {
  const option = input.trim().toLowerCase();

  if (option === 'q') {
    console.log('\n\x1b[32mEncerrando o terminal de testes. Até mais!\x1b[0m\n');
    rl.close();
    process.exit(0);
  }

  switch (option) {
    case '1':
      console.log('\n\x1b[35m[Ação] Enviando pacote de diagnóstico para a iDFace...\x1b[0m');
      const diag = await client.testConnection();
      if (diag.online) {
        console.log(`\x1b[32m✅ ONLINE! Comunicação com a Catraca física estabelecida com sucesso.\x1b[0m`);
        console.log(`   Modelo: ${diag.details?.model || 'iDFace'}`);
        console.log(`   Número de Série: ${diag.details?.serial || 'N/A'}`);
        console.log(`   Versão de Firmware: v${diag.details?.version || 'N/A'}`);
      } else {
        console.log(`\x1b[31m❌ OFFLINE: ${diag.message}\x1b[0m`);
      }
      break;

    case '2':
      console.log('\n\x1b[35m[Ação] Enviando comando físico para destravar ENTRADA (Sentido Horário)...\x1b[0m');
      try {
        const res = await client.unlockTurnstile('clockwise');
        console.log(`\x1b[32m✅ Comando enviado! Resposta do Hardware:\x1b[0m`, JSON.stringify(res));
      } catch (err: any) {
        console.log(`\x1b[31m❌ Falha ao destravar: ${err.message}\x1b[0m`);
      }
      break;

    case '3':
      console.log('\n\x1b[35m[Ação] Enviando comando físico para destravar SAÍDA (Sentido Anti-horário)...\x1b[0m');
      try {
        const res = await client.unlockTurnstile('anticlockwise');
        console.log(`\x1b[32m✅ Comando enviado! Resposta do Hardware:\x1b[0m`, JSON.stringify(res));
      } catch (err: any) {
        console.log(`\x1b[31m❌ Falha ao destravar: ${err.message}\x1b[0m`);
      }
      break;

    default:
      console.log('\n\x1b[31mOpção inválida. Digite 1, 2, 3 ou q.\x1b[0m');
  }

  // Retorna ao menu após 1.5 segundos
  setTimeout(showMenu, 1500);
}

// Inicia o menu interativo
showMenu();
