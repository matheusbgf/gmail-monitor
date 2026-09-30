'use strict';

const logger = require('../logger');
const {
  isWithinCheckpointWindow,
} = require('./operating-window');

const checkpointLogger = logger.child(
  'CHECKPOINT_SCHEDULER'
);

class CheckpointScheduler {
  constructor(callback, interval) {
    if (typeof callback !== 'function') {
      throw new TypeError(
        'O callback do CheckpointScheduler deve ser uma função.'
      );
    }

    if (!Number.isFinite(interval) || interval <= 0) {
      throw new TypeError(
        'O intervalo do CheckpointScheduler deve ser maior que zero.'
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
      checkpointLogger.warn(
        'Checkpoint anterior ainda está em execução. Ignorando novo ciclo.'
      );
      return;
    }

    if (!isWithinCheckpointWindow()) {
      checkpointLogger.debug(
        'Checkpoint fora da janela de operação. Ignorando ciclo.'
      );
      return;
    }

    this.running = true;

    try {
      await this.callback();
    } catch (error) {
      checkpointLogger.error(
        'Erro durante execução do CheckpointScheduler.',
        error
      );
    } finally {
      this.running = false;
    }
  }

  getDelayToNextSlot() {
    const now = Date.now();

    const currentSlot =
      Math.floor(now / this.interval) *
      this.interval;

    const nextSlot =
      currentSlot + this.interval;

    return Math.max(
      1000,
      nextSlot - now
    );
  }

  scheduleNext() {
    if (!this.started) {
      return;
    }

    const delay = this.getDelayToNextSlot();

    this.timer = setTimeout(
      async () => {
        this.timer = null;

        await this.execute();

        this.scheduleNext();
      },
      delay
    );
  }

  start() {
    if (this.started) {
      checkpointLogger.warn(
        'CheckpointScheduler já está em execução.'
      );
      return;
    }

    this.started = true;

    checkpointLogger.info(
      'CheckpointScheduler iniciado.',
      {
        interval: this.interval,
      }
    );

    this.scheduleNext();
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.started = false;

    checkpointLogger.info(
      'CheckpointScheduler parado.'
    );
  }
}

module.exports = CheckpointScheduler;
