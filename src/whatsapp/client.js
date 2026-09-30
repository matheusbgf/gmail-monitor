'use strict';

const logger = require('../logger');
const config = require('../config');

const whatsappLogger = logger.child('WHATSAPP_API');

class WhatsAppClient {
  /**
   * Envia um checkpoint com imagem para o bot WhatsApp existente.
   *
   * @param {string} message
   * @param {string} imagePath
   * @returns {Promise<object>}
   */
  async sendCheckpoint(message, imagePath) {
    if (!config.whatsapp.enabled) {
      whatsappLogger.warn(
        'Integração WhatsApp desabilitada. Checkpoint não enviado.'
      );

      return {
        success: true,
        skipped: true,
      };
    }

    if (
      typeof message !== 'string' ||
      message.trim().length === 0
    ) {
      throw new Error(
        'A mensagem do checkpoint não pode ser vazia.'
      );
    }

    if (
      typeof imagePath !== 'string' ||
      imagePath.trim().length === 0
    ) {
      throw new Error(
        'O caminho da imagem do checkpoint não pode ser vazio.'
      );
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, config.whatsapp.apiTimeout);

    try {
      whatsappLogger.debug(
        'Enviando checkpoint para o bot WhatsApp.',
        {
          groupId: config.whatsapp.groupId,
          imagePath,
          messageLength: message.length,
        }
      );

      const response = await fetch(
        config.whatsapp.apiUrl,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'X-API-Token': config.whatsapp.apiToken,
          },

          body: JSON.stringify({
            groupId: config.whatsapp.groupId,
            message,
            tipo: 1,
            imagePath,
          }),

          signal: controller.signal,
        }
      );

      const responseText = await response.text();

      let responseData;

      try {
        responseData = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        responseData = {
          raw: responseText,
        };
      }

      if (!response.ok) {
        const error = new Error(
          `API WhatsApp respondeu com HTTP ${response.status}.`
        );

        error.response = {
          status: response.status,
          data: responseData,
        };

        throw error;
      }

      if (
        responseData &&
        responseData.success === false
      ) {
        const error = new Error(
          'A API WhatsApp informou falha no envio do checkpoint.'
        );

        error.response = {
          status: response.status,
          data: responseData,
        };

        throw error;
      }

      whatsappLogger.info(
        'Checkpoint enviado para o bot WhatsApp.',
        {
          groupId: config.whatsapp.groupId,
          status: response.status,
        }
      );

      return responseData;
    } catch (error) {
      if (error.name === 'AbortError') {
        const timeoutError = new Error(
          `Timeout ao comunicar com a API WhatsApp após ` +
          `${config.whatsapp.apiTimeout} ms.`
        );

        timeoutError.cause = error;

        whatsappLogger.error(
          'Timeout na comunicação com o bot WhatsApp durante checkpoint.',
          timeoutError
        );

        throw timeoutError;
      }

      whatsappLogger.error(
        'Falha ao enviar checkpoint para o bot WhatsApp.',
        error
      );

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Envia uma mensagem para o grupo através do
   * bot WhatsApp existente.
   *
   * O MDG não mantém sessão do WhatsApp.
   * Apenas utiliza a API HTTP do bot.
   *
   * @param {string} message
   * @returns {Promise<object>}
   */
  async sendMessage(message) {
    if (!config.whatsapp.enabled) {
      whatsappLogger.warn(
        'Integração WhatsApp desabilitada. Mensagem não enviada.'
      );

      return {
        success: true,
        skipped: true,
      };
    }

    if (
      typeof message !== 'string' ||
      message.trim().length === 0
    ) {
      throw new Error(
        'A mensagem do WhatsApp não pode ser vazia.'
      );
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, config.whatsapp.apiTimeout);

    try {
      whatsappLogger.debug(
        'Enviando alerta para o bot WhatsApp.',
        {
          groupId: config.whatsapp.groupId,
          messageType: config.whatsapp.messageType,
          messageLength: message.length,
        }
      );

      const response = await fetch(
        config.whatsapp.apiUrl,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'X-API-Token': config.whatsapp.apiToken,
          },

          body: JSON.stringify({
            groupId: config.whatsapp.groupId,
            message,
            tipo: config.whatsapp.messageType,
          }),

          signal: controller.signal,
        }
      );

      const responseText = await response.text();

      let responseData;

      try {
        responseData = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        responseData = {
          raw: responseText,
        };
      }

      if (!response.ok) {
        const error = new Error(
          `API WhatsApp respondeu com HTTP ${response.status}.`
        );

        error.response = {
          status: response.status,
          data: responseData,
        };

        throw error;
      }

      if (
        responseData &&
        responseData.success === false
      ) {
        const error = new Error(
          'A API WhatsApp informou falha no envio.'
        );

        error.response = {
          status: response.status,
          data: responseData,
        };

        throw error;
      }

      whatsappLogger.info(
        'Alerta enviado para o bot WhatsApp.',
        {
          groupId: config.whatsapp.groupId,
          status: response.status,
        }
      );

      return responseData;
    } catch (error) {
      if (error.name === 'AbortError') {
        const timeoutError = new Error(
          `Timeout ao comunicar com a API WhatsApp após ` +
          `${config.whatsapp.apiTimeout} ms.`
        );

        timeoutError.cause = error;

        whatsappLogger.error(
          'Timeout na comunicação com o bot WhatsApp.',
          timeoutError
        );

        throw timeoutError;
      }

      whatsappLogger.error(
        'Falha ao enviar alerta para o bot WhatsApp.',
        error
      );

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = WhatsAppClient;