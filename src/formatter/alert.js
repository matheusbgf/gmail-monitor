'use strict';

const logger = require('../logger');

const formatterLogger = logger.child('FORMATTER');

const MAX_MESSAGE_LENGTH = 4000;

/**
 * Formata a data do e-mail para o padrão brasileiro.
 */
function formatDate(date) {
  if (!date) {
    return 'Data desconhecida';
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Data desconhecida';
  }

  return parsedDate.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
}

/**
 * Retorna o remetente de forma segura.
 */
function formatSender(sender) {
  const name = sender?.name?.trim();
  const address = sender?.address?.trim();

  if (name && address) {
    return `${name} <${address}>`;
  }

  return (
    name ||
    address ||
    'Remetente desconhecido'
  );
}

/**
 * Formata a lista de anexos.
 */
function formatAttachments(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return '';
  }

  const lines = attachments.map(
    (attachment) => {
      const filename =
        attachment.filename ||
        'Arquivo sem nome';

      return `📎 ${filename}`;
    }
  );

  return [
    '',
    '📂 *Anexos:*',
    ...lines,
  ].join('\n');
}

/**
 * Limita o tamanho final da mensagem.
 */
function limitMessageLength(message) {
  if (
    message.length <= MAX_MESSAGE_LENGTH
  ) {
    return message;
  }

  return (
    message.slice(
      0,
      MAX_MESSAGE_LENGTH - 20
    ) +
    '\n\n' +
    '... [mensagem truncada]'
  );
}

/**
 * Formata um e-mail em uma mensagem
 * pronta para envio pelo WhatsApp.
 */
function formatAlert(email) {
  if (!email) {
    throw new Error(
      'E-mail não informado para formatação'
    );
  }

  if (!email.id) {
    throw new Error(
      'E-mail não possui ID'
    );
  }

  const sender =
    formatSender(email.sender);

  const subject =
    email.subject ||
    '(Sem assunto)';

  const date =
    formatDate(email.date);

  const body =
    email.body?.trim() ||
    '(Sem conteúdo)';

  const attachments =
    formatAttachments(
      email.attachments
    );

  const message = [
    '📧 *NOVO E-MAIL*',
    '',
    `👤 *De:* ${sender}`,
    `📌 *Assunto:* ${subject}`,
    `🕒 *Data:* ${date}`,
    '',
    '📝 *Mensagem:*',
    body,
    attachments,
  ]
    .filter(
      (value) =>
        value !== undefined &&
        value !== null &&
        value !== ''
    )
    .join('\n');

  const formattedMessage =
    limitMessageLength(message);

  formatterLogger.debug(
    'Alerta formatado',
    {
      messageId: email.id,
      length:
        formattedMessage.length,
    }
  );

  return formattedMessage;
}

module.exports = {
  formatAlert,
  formatDate,
  formatSender,
  formatAttachments,
};