'use strict';

const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 3000;
const MAX_SENDER_LENGTH = 200;
const MAX_ATTACHMENT_NAME_LENGTH = 200;

/**
 * Normaliza espaços e quebras de linha.
 */
function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Remove HTML e conteúdo potencialmente executável.
 */
function stripHtml(html) {
  return String(html || '')
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      ''
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      ''
    )
    .replace(
      /<!--[\s\S]*?-->/g,
      ''
    )
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Limita o tamanho de um texto.
 */
function truncate(value, maxLength) {
  const normalized =
    normalizeWhitespace(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return (
    normalized.slice(0, maxLength - 3) +
    '...'
  );
}

/**
 * Sanitiza informações do remetente.
 */
function sanitizeSender(sender) {
  return {
    name: truncate(
      sender?.name || '',
      MAX_SENDER_LENGTH
    ),

    address: truncate(
      sender?.address || '',
      MAX_SENDER_LENGTH
    ),
  };
}

/**
 * Sanitiza informações dos anexos.
 */
function sanitizeAttachments(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments.map((attachment) => ({
    filename: truncate(
      attachment.filename || '',
      MAX_ATTACHMENT_NAME_LENGTH
    ),

    contentType: truncate(
      attachment.contentType || '',
      100
    ),

    size:
      Number.isFinite(attachment.size) &&
      attachment.size >= 0
        ? attachment.size
        : 0,
  }));
}

/**
 * Sanitiza um e-mail completo.
 */
function sanitizeEmail(email) {
  if (!email) {
    throw new Error(
      'E-mail não informado para sanitização'
    );
  }

  if (!email.id) {
    throw new Error(
      'E-mail não possui ID'
    );
  }

  const bodySource =
    email.text ||
    stripHtml(email.html);

  return {
    id: email.id,

    threadId:
      email.threadId || null,

    messageId:
      email.messageId || null,

    subject: truncate(
      email.subject || '(Sem assunto)',
      MAX_SUBJECT_LENGTH
    ),

    sender:
      sanitizeSender(
        email.sender
      ),

    recipients:
      Array.isArray(email.recipients)
        ? email.recipients.map(
            (recipient) => ({
              name: truncate(
                recipient.name || '',
                MAX_SENDER_LENGTH
              ),

              address: truncate(
                recipient.address || '',
                MAX_SENDER_LENGTH
              ),
            })
          )
        : [],

    date:
      email.date || null,

    body: truncate(
      bodySource,
      MAX_BODY_LENGTH
    ),

    attachments:
      sanitizeAttachments(
        email.attachments
      ),
  };
}

module.exports = {
  sanitizeEmail,
  stripHtml,
  truncate,
};