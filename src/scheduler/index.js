'use strict';

const logger = require('../logger');

const schedulerLogger = logger.child('SCHEDULER');

class Scheduler {
  constructor(callback, interval) {
    if (typeof callback !== 'function') {
      throw new TypeError(
        'O callback do Scheduler deve ser uma função.'
      );
    }

    if (!Number.isFinite(interval) || interval <= 0) {
      throw new TypeError(
        'O intervalo do Scheduler deve ser um número maior que zero.'
      );
    }

    this.callback = callback;
    this.interval = interval;
    this.timer = null;
    this.running = false;
    this.started = false;
  }

  async execute() {
    if (this.running) {
      schedulerLogger.warn(
        'Ciclo anterior ainda está em execução. Ignorando novo ciclo.'
      );
      return;
    }

    this.running = true;

    try {
      await this.callback();
    } catch (error) {
      schedulerLogger.error(
        'Erro durante execução do Scheduler.',
        error
      );
    } finally {
      this.running = false;
    }
  }

  start() {
    if (this.started) {
      schedulerLogger.warn(
        'Scheduler já está em execução.'
      );
      return;
    }

    this.started = true;

    schedulerLogger.info(
      'Scheduler iniciado.',
      {
        interval: this.interval,
      }
    );

    // Executa imediatamente o primeiro ciclo.
    this.execute();

    // Próximos ciclos.
    this.timer = setInterval(
      () => {
        this.execute();
      },
      this.interval
    );
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.started = false;

    schedulerLogger.info(
      'Scheduler parado.'
    );
  }
}

module.exports = Scheduler;
