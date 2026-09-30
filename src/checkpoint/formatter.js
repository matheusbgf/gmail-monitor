'use strict';

const CLIENT_NAME = 'Agencia Estado';

function formatCheckpointMessage(tool) {
  const normalizedTool = String(tool)
    .trim()
    .toLowerCase();

  const tools = {
    gmail: 'Gmail',
    grafana: 'Grafana',
  };

  const toolName = tools[normalizedTool];

  if (!toolName) {
    throw new Error(
      `Ferramenta inválida para checkpoint: ${tool}`
    );
  }

  return [
    `Checkpoint - ${toolName} [${CLIENT_NAME}]`,
    '',
    '⏱️ Período das últimas 1 horas.',
    '',
    'Equipe SOC',
    'Core | Technologies',
  ].join('\n');
}

module.exports = {
  formatCheckpointMessage,
};
