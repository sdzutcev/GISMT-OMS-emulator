const conf = require('./conf.js');
const log = require('./log.js');

let userDefaultLang = null;
let errors = null;

exports.init = async function () {
  return new Promise((resolve, reject) => {
    try {
      log.debug('Инициализация подсистемы обработки ошибок...');

      userDefaultLang = conf.errors.userDefaultLang;
      errors = conf.errors.errors;

      log.debug('Инициализация подсистемы обработки ошибок завершена успешно');
      exports.ready = true;
      resolve();
    } catch (err) {
      reject(err);
    }
  });
};

const hError = class {
  constructor(
    err,
    errorMessage = null,
    refId = null,
    addInfo = null,
    lang = userDefaultLang
  ) {
    this.addToStack(err, errorMessage, refId, addInfo, lang);
    return this;
  }

  addToStack(
    err,
    errorMessage = null,
    refId = null,
    addInfo = null,
    lang = userDefaultLang
  ) {
    const stackRec = {};

    let nodeStackFull = null;
    let errType = null;

    if (err instanceof Error) {
      errType = 'sysError';

      // ==================================UPDATED=============================================

      if (err.stack) {
        nodeStackFull = err.stack.split('\n');
        if (nodeStackFull && nodeStackFull[1])
            stackRec.caller = nodeStackFull[1].trim();

          const myObject = {};
          Error.captureStackTrace(myObject);
          myObject.stack;

          var nodeStackFull2 = myObject.stack.split('\n');
          if (nodeStackFull2 && nodeStackFull2[3]) {
            stackRec.caller = nodeStackFull2[3] + " -> " + stackRec.caller;
          }
      }

      // ==================================UPDATED=============================================

      if (errorMessage) {
        stackRec.logMessage = `${errorMessage}: ${err.message}`;
      } else {
        stackRec.logMessage = err.message;
      }

      stackRec.code = 'E_ServerError';
    }

    if (!nodeStackFull) {
      nodeStackFull = new Error().stack.split('\n');
      if (nodeStackFull[3]) stackRec.caller = nodeStackFull[3].trim();
    }

    // console.log(nodeStackFull);

    if (!errType && err instanceof hError) {
      // Копируем стэк ошибок из предыдущей ошибки
      if (err.stack && Array.isArray(err.stack) && err.stack.length > 0) {
        this.stack = err.stack;
      }
      errType = 'errorObj';
      if (errorMessage) stackRec.logMessage = errorMessage;
    }

    if (!errType && errors[err]) {
      errType = 'errorCode';
      stackRec.code = err;

      if (errorMessage) {
        stackRec.logMessage = errorMessage;
      } else {
        stackRec.logMessage = errors[stackRec.code][lang].logMessage;
      }
    }

    if (!errType) {
      stackRec.errType = 'errorText';
      stackRec.code = 'E_ServerError';

      stackRec.logMessage = '';
      if (errorMessage) stackRec.logMessage = errorMessage;
      if (err) {
        if (errorMessage) stackRec.logMessage += ': ';
        stackRec.logMessage += err;
      }
    }

    if (errType != 'errorObj') {
      stackRec.userMessage = errors[stackRec.code][lang].userMessage;
      stackRec.httpCode = errors[stackRec.code][lang].httpCode;
      if (refId) stackRec.refId = refId;
    }

    if (addInfo) {
      if (addInfo.req) stackRec.req = addInfo.req;
      if (addInfo.sysErr) stackRec.sysErr = sysErr;
      if (addInfo.req) stackRec.req = req;
    }

    if (!this.stack) this.stack = [];
    this.stack.push(stackRec);
    return this;
  }

  log() {
    if (this.stack && Array.isArray(this.stack) && this.stack.length > 0) {
      // Ищем данные реквеста хотя бы у одной записи из стека
      let req = null;

      for (let i = 0; i < this.stack.length; i++) {
        if (this.stack[i].req) {
          req = this.stack[i].req;
          break;
        }
      }

      const logRec = {
        code: this.stack[0].code,
        httpCode: this.stack[0].httpCode,
        userMessage: this.stack[0].userMessage,
        error: this.stack[0].logMessage,
        refId: this.stack[0].refId,
        sysErr: this.stack[0].sysErr,

        //if (errRec.refId.prodOrderNumber) errRec.prodOrderNumber = errRec.refId.prodOrderNumber;
        //if (errRec.refId.orderId) errRec.orderId = errRec.refId.orderId;
        //if (errRec.refId.reportId) errRec.reportId = errRec.refId.reportId;
        //if (errRec.refId.moduleCode) errRec.moduleCode = errRec.refId.moduleCode;
        //if (errRec.refId.reportFileName) errRec.reportFileName = errRec.refId.reportFileName;
        //if (errRec.refId.dateTime) errRec.dateTime = errRec.refId.dateTime;

        req,
        hordeStack: this.stack,
      };

      log.rec(logRec);
    } else {
      log.warn('Попытка логирования пустого объекта Error');
    }
    return this;
  }
};

exports.Error = hError;

exports.getErrorLogMessage = function (errCode, lang = userDefaultLang) {
  let ret = `Неизвестный код ошибки: ${errCode}`;

  if (
    errors[errCode] &&
    errors[errCode][lang] &&
    errors[errCode][lang].logMessage
  ) {
    ret = errors[errCode][lang].logMessage;
  }

  return ret;
};

exports.getErrorUserMessage = function (errCode, lang = userDefaultLang) {
  let ret = 'Ошибка сервера';

  if (
    errors[errCode] &&
    errors[errCode][lang] &&
    errors[errCode][lang].userMessage
  ) {
    ret = errors[errCode][lang].userMessage;
  }

  return ret;
};

exports.getErrorHttpStatus = function (errCode) {
  let ret = 500;

  if (errors[errCode] && errors[errCode].httpCode) {
    ret = errors[errCode].httpCode;
  }

  return ret;
};
