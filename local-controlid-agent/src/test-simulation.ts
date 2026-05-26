import * as dotenv from 'dotenv';
import * as path from 'path';
import { ControlIdClient } from './ControlIdClient';

// Carrega variáveis do .env local do agente
dotenv.config({ path: path.join(__dirname, '../.env') });

async function runDemoSimulation() {
  console.log('\n\x1b[35m==================================================\x1b[0m');
  console.log('\x1b[1m\x1b[32m       CARRASCO FIT — SIMULADOR CONTROL iD        \x1b[0m');
  console.log('\x1b[35m==================================================\x1b[0m');
  console.log('Iniciando ciclo de testes e diagnóstico em modo de simulação...\n');

  // Força flag do simulador
  process.env.CONTROLID_SIMULATOR = 'true';
  
  const client = new ControlIdClient();

  // Teste 1: Diagnóstico de Conexão Física
  console.log('\x1b[33m[TESTE 1/3] Solicitando diagnóstico de rede local...\x1b[0m');
  const connResult = await client.testConnection();
  
  if (connResult.online) {
    console.log(`\x1b[32m✅ Status: ONLINE\x1b[0m`);
    console.log(`\x1b[36m   Mensagem: ${connResult.message}\x1b[0m`);
    console.log(`   Equipamento: \x1b[1m${connResult.details.model}\x1b[0m`);
    console.log(`   Número de Série: \x1b[35m${connResult.details.serial}\x1b[0m`);
    console.log(`   Firmware: v${connResult.details.version}`);
    console.log(`   Consumo de CPU: \x1b[32m${connResult.details.cpu}\x1b[0m`);
    console.log(`   Consumo de RAM: \x1b[32m${connResult.details.ram}\x1b[0m`);
  } else {
    console.log(`\x1b[31m❌ Equipamento Offline: ${connResult.message}\x1b[0m`);
  }
  console.log('\n--------------------------------------------------\n');

  // Teste 2: Liberação de Entrada (Clockwise)
  console.log('\x1b[33m[TESTE 2/3] Simulando comando de liberação ENTRADA (Sentido Horário)...\x1b[0m');
  await new Promise(resolve => setTimeout(resolve, 1000));
  const unlockClockwise = await client.unlockTurnstile('clockwise');
  console.log('Resposta do Hardware:', JSON.stringify(unlockClockwise, null, 2));
  console.log('\n--------------------------------------------------\n');

  // Teste 3: Liberação de Saída (Anticlockwise)
  console.log('\x1b[33m[TESTE 3/3] Simulando comando de liberação SAÍDA (Sentido Anti-horário)...\x1b[0m');
  await new Promise(resolve => setTimeout(resolve, 1000));
  const unlockAnticlockwise = await client.unlockTurnstile('anticlockwise');
  console.log('Resposta do Hardware:', JSON.stringify(unlockAnticlockwise, null, 2));
  console.log('\n--------------------------------------------------\n');

  console.log('\x1b[32m\x1b[1m🎉 FIM DA SIMULAÇÃO: Todas as operações do leitor físico iDFace foram simuladas com sucesso!\x1b[0m\n');
}

runDemoSimulation();
