'use strict';

const logger = require('../logger');

const windowLogger = logger.child('OPERATING_WINDOW');

const TIME_ZONE = 'America/Sao_Paulo';

function getLocalDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function dateKey(year, month, day) {
  return [
    year,
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}

function getHolidays(year) {
  const fixedHolidays = [
    `${year}-01-01`,
    `${year}-01-25`,
    `${year}-04-21`,
    `${year}-05-01`,
    `${year}-07-09`,
    `${year}-09-07`,
    `${year}-10-12`,
    `${year}-11-02`,
    `${year}-11-15`,
    `${year}-11-20`,
    `${year}-12-25`,
  ];

  const easter = easterSunday(year);

  const goodFriday = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);

  const movableHolidays = [
    goodFriday.toISOString().slice(0, 10),
    corpusChristi.toISOString().slice(0, 10),
  ];

  return new Set([
    ...fixedHolidays,
    ...movableHolidays,
  ]);
}

function isHoliday(year, month, day) {
  return getHolidays(year).has(
    dateKey(year, month, day)
  );
}

function isNonBusinessDay(year, month, day) {
  const weekday = new Date(
    Date.UTC(year, month - 1, day)
  ).getUTCDay();

  return (
    weekday === 0 ||
    weekday === 6 ||
    isHoliday(year, month, day)
  );
}

/**
 * Janela do monitoramento do Gmail.
 *
 * Dias úteis:
 *   19:00 <= horário < 07:00
 *
 * Fins de semana e feriados:
 *   funcionamento contínuo.
 */
function isWithinOperatingWindow(date = new Date()) {
  const {
    year,
    month,
    day,
    hour,
  } = getLocalDateTime(date);

  if (isNonBusinessDay(year, month, day)) {
    return true;
  }

  return hour >= 19 || hour < 7;
}

/**
 * Janela dos checkpoints.
 *
 * Em dias úteis, 07:00 também é permitido,
 * pois é o último checkpoint do ciclo.
 *
 * O Scheduler de checkpoints executa apenas
 * no início exato de cada hora.
 */
function isWithinCheckpointWindow(date = new Date()) {
  const {
    year,
    month,
    day,
    hour,
    minute,
  } = getLocalDateTime(date);

  if (isNonBusinessDay(year, month, day)) {
    return true;
  }

  if (hour >= 19 || hour < 7) {
    return true;
  }

  return hour === 7 && minute === 0;
}

function createOperatingWindowGuard(callback, name) {
  let previousState = null;

  return async (...args) => {
    const allowed = isWithinOperatingWindow();

    if (allowed !== previousState) {
      windowLogger.info(
        allowed
          ? 'Janela de operação aberta.'
          : 'Janela de operação fechada.',
        {
          component: name,
          timeZone: TIME_ZONE,
        }
      );

      previousState = allowed;
    }

    if (!allowed) {
      return;
    }

    return callback(...args);
  };
}

module.exports = {
  isWithinOperatingWindow,
  isWithinCheckpointWindow,
  createOperatingWindowGuard,
};
