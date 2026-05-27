import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import { Logger } from './logger';

export class ControlIdClient {
  private axiosInstance: AxiosInstance;
  private protocol: string;
  private ip: string;
  private port: number;
  private loginUser: string;
  private pass: string;
  private releaseAction: string;
  private releaseParams: string;
  private isSimulator: boolean;

  constructor() {
    this.isSimulator = process.env.CONTROLID_SIMULATOR === 'true';
    this.protocol = process.env.CONTROLID_PROTOCOL || 'https';
    this.ip = process.env.CONTROLID_IP || '192.168.1.100';
    this.port = parseInt(process.env.CONTROLID_PORT || '443');
    this.loginUser = process.env.CONTROLID_LOGIN || 'admin';
    this.pass = process.env.CONTROLID_PASSWORD || 'admin';
    
    // Configurações de liberação física parametrizáveis via .env
    this.releaseAction = process.env.CONTROLID_RELEASE_ACTION || 'sec_box';
    this.releaseParams = process.env.CONTROLID_RELEASE_PARAMETERS || '';
    
    // Se parâmetros não forem especificados, resolve de forma inteligente baseado no tipo de acionamento
    if (!this.releaseParams) {
      if (this.releaseAction === 'door') {
        this.releaseParams = 'door=1';
      } else if (this.releaseAction === 'catra') {
        this.releaseParams = 'allow=1';
      }
    }

    const timeout = parseInt(process.env.CONTROLID_TIMEOUT_MS || '7000');

    // Configuração para rejeitar ou aceitar certificados autoassinados da catraca
    const rejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0';

    const httpsAgent = new https.Agent({
      rejectUnauthorized
    });

    this.axiosInstance = axios.create({
      baseURL: `${this.protocol}://${this.ip}:${this.port}`,
      timeout,
      httpsAgent
    });
  }

  // Realiza login no dispositivo obtendo token de sessão
  async login(): Promise<string> {
    if (this.isSimulator) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return 'sim-session-token-12345';
    }

    try {
      const response = await this.axiosInstance.post<{ session: string }>('/login.fcgi', {
        login: this.loginUser,
        password: this.pass
      });

      if (response.data && response.data.session) {
        return response.data.session;
      }
      throw new Error('Sessão não retornada pela iDFace.');
    } catch (err: any) {
      throw new Error(`Falha no login com iDFace: ${err.message}`);
    }
  }

  // Realiza logout para encerrar de forma limpa a sessão no hardware
  async logout(session: string): Promise<void> {
    if (this.isSimulator) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return;
    }

    try {
      await this.axiosInstance.post(`/logout.fcgi?session=${session}`, {});
    } catch (err) {
      // Falhas silenciosas no logout para evitar travar loops
    }
  }

  // Verifica conexão ativa / Ping local com ciclo completo de sessão
  async testConnection(): Promise<{ online: boolean; message: string; details?: any }> {
    if (this.isSimulator) {
      await new Promise(resolve => setTimeout(resolve, 400));
      // Gera consumo flutuante realista de CPU e RAM para a simulação
      const cpu = `${Math.floor(Math.random() * 20) + 15}%`;
      const ram = `${Math.floor(Math.random() * 10) + 40}%`;
      return {
        online: true,
        message: 'SIMULAÇÃO: Conectividade local com a iDFace Simulado validada com sucesso pelo agente.',
        details: {
          serial: 'SIM-IDFACE-2026',
          model: 'iDFace Simulado (Workspace)',
          version: '2.4.8 (Simulator)',
          cpu,
          ram
        }
      };
    }

    let session = '';
    try {
      session = await this.login();
      const info = await this.getSystemInformation(session);
      return { 
        online: true, 
        message: 'Conectividade local com a iDFace validada com sucesso pelo agente.',
        details: info 
      };
    } catch (err: any) {
      return { 
        online: false, 
        message: err.message || 'Falha de comunicação local com a catraca.' 
      };
    } finally {
      if (session) {
        await this.logout(session);
      }
    }
  }

  // Dispara ação de liberação física com ciclo completo de sessão
  async unlockTurnstile(direction: "clockwise" | "anticlockwise" | "both" = 'clockwise'): Promise<unknown> {
    if (this.isSimulator) {
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const sentidoText = direction === 'clockwise' ? 'HORÁRIO (Entrada)' : 
                          direction === 'anticlockwise' ? 'ANTI-HORÁRIO (Saída)' : 'BIDIRECIONAL (Livre)';

      console.log('\n\x1b[36m========== [SIMULADOR DE HARDWARE] ========== \x1b[0m');
      console.log(`\x1b[32m🔓 COMANDO RECEBIDO: Destravando solenoide do iDFace...\x1b[0m`);
      console.log(`\x1b[33m🌀 SENTIDO CONFIGURADO: ${sentidoText}\x1b[0m`);
      console.log('\x1b[35m  \\');
      console.log('   \\  🌀 [CATRACA GIRANDO...]');
      console.log('    \\\x1b[0m');
      console.log(`\x1b[32m✅ Giro concluído! Solenoide travado novamente com sucesso.\x1b[0m`);
      console.log('\x1b[36m============================================= \x1b[0m\n');

      return {
        results: [
          {
            success: true,
            simulated: true,
            action: 'catra',
            direction
          }
        ]
      };
    }

    let session = '';
    try {
      session = await this.login();
      
      let action = this.releaseAction;
      let parameters = this.releaseParams;

      // Se o acionamento físico for do tipo catra, injeta dinamicamente o sentido de giro
      if (action === 'catra') {
        parameters = `allow=${direction}`;
      }
      
      const actionPayload = {
        actions: [
          {
            action,
            parameters
          }
        ]
      };

      const response = await this.axiosInstance.post(
        `/execute_actions.fcgi?session=${session}`,
        actionPayload
      );
      
      return response.data;
    } catch (err: any) {
      throw new Error(`Erro ao liberar catraca física: ${err.message}`);
    } finally {
      if (session) {
        await this.logout(session);
      }
    }
  }

  // Obtém estatísticas de CPU, RAM, Versão de Firmware e serial
  async getSystemInformation(token: string): Promise<any> {
    if (this.isSimulator) {
      const cpu = `${Math.floor(Math.random() * 20) + 15}%`;
      const ram = `${Math.floor(Math.random() * 10) + 40}%`;
      return {
        serial: 'SIM-IDFACE-2026',
        model: 'iDFace Simulado (Workspace)',
        version: '2.4.8 (Simulator)',
        cpu,
        ram
      };
    }

    try {
      const response = await this.axiosInstance.post(
        `/system_information.fcgi?session=${token}`,
        {}
      );
      return response.data;
    } catch (err: any) {
      throw new Error(`Erro ao consultar estatísticas do sistema: ${err.message}`);
    }
  }

  // Configura a catraca automaticamente para enviar as requisições de Push para o Agente Local
  async configurePushNotification(agentIp: string, agentPort: number): Promise<boolean> {
    if (this.isSimulator) {
      Logger.success(`[ControlIdClient][SIM] Configuração de Push simulada com sucesso para http://${agentIp}:${agentPort}/push`);
      return true;
    }

    let session = '';
    try {
      session = await this.login();
      Logger.info(`[ControlIdClient] Configurando URL de Push no equipamento para: http://${agentIp}:${agentPort}/push`);

      const configPayload = {
        general: {
          online: "1" // Habilita Modo Online (Remote Authorization) como String
        },
        monitor: {
          hostname: agentIp,
          port: String(agentPort), // String obrigatória
          path: "/push",
          request_timeout: "5000" // String obrigatória
        }
      };

      const response = await this.axiosInstance.post(
        `/set_configuration.fcgi?session=${session}`,
        configPayload
      );

      if (response.status === 200) {
        Logger.success(`[ControlIdClient] Configuração de Push e Modo Online aplicada com sucesso no leitor!`);
        return true;
      }
      throw new Error(`Status de retorno inesperado: ${response.status}`);
    } catch (err: any) {
      Logger.error(`[ControlIdClient] Falha ao configurar URL de Push na catraca: ${err.message}`);
      return false;
    } finally {
      if (session) {
        await this.logout(session);
      }
    }
  }
}
