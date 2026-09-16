'use strict';

const { simpleParser } = require('mailparser');
const logger = require('../logger');

const parserLogger = logger.child('PARSER');

/**
 * Decodifica o formato base64url utilizado pelo Gmail.
 */
function decodeBase64Url(value) {
  if (!value) {
    throw new Error(
      'Conteúdo RAW da mensagem não informado'
    );
  }

  return Buffer.from(
    value
      .replace(/-/g, '+')
      .replace(/_/g, '/'),
    'base64'
  );
}

/**
 * Extrai os dados do remetente.
 */
function parseSender(from) {
  const sender = from?.value?.[0];

  if (!sender) {
    return {
      name: '',
      address: '',
    };
  }

  return {
    name: sender.name || '',
    address: sender.address || '',
  };
}

/**
 * Extrai os destinatários.
 */
function parseRecipients(to) {
  if (!to?.value) {
    return [];
  }

  return to.value.map((recipient) => ({
    name: recipient.name || '',
    address: recipient.address || '',
  }));
}

/**
 * Extrai informações dos anexos.
 *
 * O conteúdo binário não é mantido no objeto final.
 * O monitoramento só precisa das informações
 * necessárias para o alerta.
 */
function parseAttachments(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments.map((attachment) => ({
    filename: attachment.filename || '',
    contentType: attachment.contentType || '',
    size: attachment.size || 0,
  }));
}

/**
 * Converte uma mensagem RAW do Gmail
 * em um objeto estruturado.
 */
async function parseGmailMessage(gmailMessage) {
  if (!gmailMessage) {
    throw new Error(
      'Mensagem Gmail não informada'
    );
  }

  if (!gmailMessage.id) {
    throw new Error(
      'Mensagem Gmail não possui ID'
    );
  }

  if (!gmailMessage.raw) {
    throw new Error(
      `Mensagem Gmail ${gmailMessage.id} não possui conteúdo RAW`
    );
  }

  parserLogger.debug(
    'Iniciando parsing da mensagem',
    {
      messageId: gmailMessage.id,
    }
  );

  try {
    const buffer =
      decodeBase64Url(
        gmailMessage.raw
      );

    const parsed =
      await simpleParser(buffer);

    const sender =
      parseSender(parsed.from);

    const recipients =
      parseRecipients(parsed.to);

    const attachments =
      parseAttachments(
        parsed.attachments
      );

    const result = {
      id: gmailMessage.id,

      threadId:
        gmailMessage.threadId || null,

      messageId:
        parsed.messageId || null,

      subject:
        parsed.subject ||
        '(Sem assunto)',

      sender,

      recipients,

      date:
        parsed.date
          ? parsed.date.toISOString()
          : null,

      text:
        parsed.text || '',

      html:
        typeof parsed.html === 'string'
          ? parsed.html
          : '',

      attachments,
    };

    parserLogger.info(
      'Mensagem processada pelo parser',
      {
        messageId: result.id,
        subject: result.subject,
        attachments:
          result.attachments.length,
      }
    );

    return result;
  } catch (error) {
    parserLogger.error(
      `Falha ao fazer parsing da mensagem ${gmailMessage.id}`,
      error
    );

    throw error;
  }
}

module.exports = {
  parseGmailMessage,
};