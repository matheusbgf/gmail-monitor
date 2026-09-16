'use strict';

const logger = require('../logger');

const gmailLogger = logger.child('GMAIL_SERVICE');

/**
 * Lista mensagens de acordo com os parâmetros informados.
 *
 * @param {object} gmail - Cliente autenticado da Gmail API.
 * @param {object} options
 * @param {string} options.query - Query da Gmail API.
 * @param {number} options.maxResults - Limite de mensagens.
 * @returns {Promise<Array>}
 */
async function listMessages(
  gmail,
  {
    query,
    maxResults,
  }
) {
  if (!gmail) {
    throw new Error(
      'Cliente Gmail não informado'
    );
  }

  gmailLogger.debug(
    'Consultando mensagens do Gmail',
    {
      query,
      maxResults,
    }
  );

  try {
    const response =
      await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

    const messages =
      response.data.messages || [];

    gmailLogger.info(
      'Consulta de mensagens concluída',
      {
        count: messages.length,
        query,
      }
    );

    return messages;
  } catch (error) {
    gmailLogger.error(
      'Falha ao listar mensagens do Gmail',
      error
    );

    throw error;
  }
}

/**
 * Busca uma mensagem específica pelo ID.
 *
 * @param {object} gmail - Cliente autenticado.
 * @param {string} messageId - ID da mensagem.
 * @returns {Promise<object>}
 */
async function getMessage(
  gmail,
  messageId
) {
  if (!gmail) {
    throw new Error(
      'Cliente Gmail não informado'
    );
  }

  if (!messageId) {
    throw new Error(
      'ID da mensagem não informado'
    );
  }

  gmailLogger.debug(
    'Buscando mensagem do Gmail',
    {
      messageId,
    }
  );

  try {
    const response =
      await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'raw',
      });

    gmailLogger.debug(
      'Mensagem obtida com sucesso',
      {
        messageId,
      }
    );

    return response.data;
  } catch (error) {
    gmailLogger.error(
      `Falha ao obter mensagem ${messageId}`,
      error
    );

    throw error;
  }
}

/**
 * Consulta mensagens novas.
 */
async function fetchNewMessages(
  gmail,
  options
) {
  gmailLogger.info(
    'Iniciando consulta de novos e-mails'
  );

  return listMessages(
    gmail,
    options
  );
}

module.exports = {
  listMessages,
  getMessage,
  fetchNewMessages,
};