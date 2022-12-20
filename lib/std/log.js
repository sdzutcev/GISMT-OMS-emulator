var conf = require('./conf.js');

var moment = require('moment');
var findRemoveSync = require('find-remove');
const uuidBase62 = require('uuid-base62');
const SimpleNodeLogger = require('simple-node-logger');
var manager = new SimpleNodeLogger();
var fluent = require('fluent-logger');

const {ObjectId} = require('mongodb');


var isFileLoggerInited = false;

exports.flog = null;
exports.slog = null;

exports.errorsToSend = [];
exports.currStats = [];
var currRefs = {};

var logBuf = {}
var logBufLimit = 50000;

exports.init = async function() {
    return new Promise((resolve, reject) => {
        try {
            console.log("Инициализация подсистемы логирования...");

            if (typeof(conf.log.logMode) != "undefined" && conf.log.logMode == "file") {
                conf.log.logMode = "file";
                console.log("Включен режим логирования в файлы. Уровень логирования: " + conf.log.logLevel + ". Путь: " + conf.main.logsPath);
            }

            if (typeof(conf.log.logMode) != "undefined" && conf.log.logMode == "fluent") {
                conf.log.logMode = "fluent";

                fluent.configure(conf.main.serviceName, {
                    host: conf.log.fluentdHost,
                    port: conf.log.fluentdPort,
                    timeout: 3.0,
                    reconnectInterval: 300000 // 5 minutes
                });

                console.log("Включен режим логирования во fluentd. Сервер: " + conf.log.fluentdHost + ":" + conf.log.fluentdPort);
            }

            if (conf.log.logMode == "console" || conf.log.logMode == "console") {
                console.log("Включен режим логирования в консоль. Уровень логирования: " + conf.log.logLevel);
            }

            setInterval(statsClean, 60*1000);

     
            exports.debug("Инициализация подсистемы логирования завершена успешно");
            exports.ready = true;
            resolve();
        } catch (err) {
            reject(err);
        }
    });
}

function removeLogEscaping(rec) {
    var retRec = rec;
    if (retRec.error) retRec.error = removeStrEscaping(removeStrEscaping(removeStrEscaping(rec.error)));
    if (retRec.warn) retRec.warn = removeStrEscaping(removeStrEscaping(removeStrEscaping(rec.warn)));
    if (retRec.info) retRec.info = removeStrEscaping(removeStrEscaping(removeStrEscaping(rec.info)));
    if (retRec.debug) retRec.debug = removeStrEscaping(removeStrEscaping(removeStrEscaping(rec.debug)));
    if (retRec.trace) retRec.trace = removeStrEscaping(removeStrEscaping(removeStrEscaping(rec.trace)));

    return retRec;
}

function removeStrEscaping(str) {
    var ret = str;
    if (typeof ret === 'object') ret = JSON.stringify(ret);
    if (ret) {
        try {
            ret = ret.replace(`\"`, `"`);
            ret = ret.replace(`\\n`, `\n`);
            ret = ret.replace(`\\\\`, `\\`);
            ret = ret.replace(`\/`, `/`);
        } catch(err) {
            console.log("Ошибка при обработке строки логирования. \nОшибка: " + err + "\nСтрока: " + JSON.stringify(str));
        };
    }
    return ret;
}

function trimLongString(str) {
    var ret = str;

    if (str && typeof str === 'string' && str.length > 5000) {
        var cutLen = str.length-5000;
        ret = str.substring(0, 2500) + '\n................(' + cutLen + ')\n' + str.substring(str.length - 2500);
    }

    return ret;
}

exports.lastError = null;
exports.lastWarn = null;

exports.rec = async function(errRec) {

    if (errRec.refId && typeof errRec.refId == 'object') {
        if (errRec.refId.prodOrderNumber) errRec.prodOrderNumber = errRec.refId.prodOrderNumber;
        if (errRec.refId.orderId) errRec.orderId = errRec.refId.orderId;
        if (errRec.refId.reportId) errRec.reportId = errRec.refId.reportId;
        if (errRec.refId.moduleCode) errRec.moduleCode = errRec.refId.moduleCode;
        if (errRec.refId.reportFileName) errRec.reportFileName = errRec.refId.reportFileName;
        if (errRec.refId.userLogin) errRec.userLogin = errRec.refId.userLogin;
        if (errRec.refId.lineName) errRec.lineName = errRec.refId.lineName;

        if (errRec.refId.dateTime) errRec.dateTime = errRec.refId.dateTime;

        if (errRec.refId.refId) {
            var r = errRec.refId.refId;
            errRec.refId = r;
        } else {
            delete errRec.refId;
        }
    }

    var logsOrderIdObjectId = null;
    if (errRec.orderId && ObjectId.isValid(errRec.orderId)) logsOrderIdObjectId = ObjectId(errRec.orderId);
    errRec.orderId = logsOrderIdObjectId;

    var logsReportIdObjectId = null;
    if (errRec.reportId && ObjectId.isValid(errRec.reportId)) logsReportIdObjectId = ObjectId(errRec.reportId);
    errRec.reportId = logsReportIdObjectId;
    
    // Иницализация файлового логгера
    if (!isFileLoggerInited && conf.log.logMode == "file") {
        
        logOpts = {
            logDirectory: conf.main.logsPath,
            fileNamePattern:'<DATE>.log',
            dateFormat:'YYYY.MM.DD'
        };

        exports.flog = SimpleNodeLogger.createRollingFileLogger(logOpts);
        exports.flog.setLevel('trace');

        statOpts = {
            logDirectory: conf.main.logsPath,
            fileNamePattern:'stat-<DATE>.log',
            dateFormat:'YYYY-MM-DD'
        };

        exports.slog = SimpleNodeLogger.createRollingFileLogger(statOpts);
        exports.slog.setLevel('trace');

        isFileLoggerInited = true;
    }

    // Если запись является сообщением об ошибке, то создаем дополнительные поля
    var errObject = null;
    var logDate = moment();

    if (errRec.dateTime) logDate = moment(errRec.dateTime).local();

    if (conf.main.instanceName && !errRec.instance) {
        errRec.instance = conf.main.instanceName;
    }

    if (conf.main.serviceName && !errRec.service) {
        errRec.service = conf.main.serviceName;
    }

    //if (errRec.moduleCode) {
    //    errRec.service = errRec.moduleCode;
    //}

    if (errRec.error || errRec.sysErr) {
        // if (!errRec.code) errRec.code = 'E_ServerError';
        if (!errRec.code && errRec.sysErr && errRec.sysErr.code) errRec.code = errRec.sysErr.code;
        errObject = new exports.ApiErr(errRec.code);
        errRec.stack = errObject.stack;
        
        if (errRec.code) {
            errRec.apiCode = errRec.code;
            errRec.apiStatus = errRec.httpCode;
            errRec.apiMessage = errRec.userMessage;
        }

        if (errRec.sysErr) {
            errRec.sysCode = errRec.sysErr.code;
            errRec.sysMessage = errRec.sysErr.message;
            errRec.sysStack = errRec.sysErr.stack;
        }
    }

    if (errRec.req) {
        // Получаем данные HTTP запроса
        if (errRec.req.connection) {
            errRec.reqIp = errRec.req.headers['x-real-ip'] || errRec.req.headers['x-forwarded-for'] || errRec.req.connection.remoteAddress || errRec.req.socket.remoteAddress || errRec.req.connection.socket.remoteAddress;
        }

        errRec.reqBody = errRec.req.body;
        errRec.reqHeaders = errRec.req.headers;
        errRec.reqParams = errRec.req.params;

        errRec.reqMethod = errRec.req.method;
        errRec.reqOriginalUrl = errRec.req.originalUrl;
    }

    var savedRec = {};

    if (errRec.refId && currRefs[errRec.refId]) {
        savedRec = currRefs[errRec.refId];

        if (savedRec) {
            // Получаем сохраненные ранее данные
            if (!errRec.reqIp) errRec.reqIp = savedRec.reqIp;
            if (!errRec.reqBody) errRec.reqBody = savedRec.reqBody;
            if (!errRec.reqHeaders) errRec.reqHeaders = savedRec.reqHeaders;
            if (!errRec.reqParams) errRec.reqParams = savedRec.reqParams;
            if (!errRec.reqMethod) errRec.reqMethod = savedRec.reqMethod;
            if (!errRec.reqOriginalUrl) errRec.reqOriginalUrl = savedRec.reqOriginalUrl;

            if (!errRec.userId) errRec.userId = savedRec.userId;
            if (!errRec.userLogin) errRec.userLogin = savedRec.userLogin;
            if (!errRec.userName) errRec.userName = savedRec.userName;
        }
    }

    // Обновляем данные в savedRec
    if (errRec.refId) {
        if (!savedRec['reqIp'] && errRec['reqIp']) savedRec['reqIp'] = errRec['reqIp'];
        if (!savedRec['reqBody'] && errRec['reqBody']) savedRec['reqBody'] = errRec['reqBody'];
        if (!savedRec['reqHeaders'] && errRec['reqHeaders']) savedRec['reqHeaders'] = errRec['reqHeaders'];
        if (!savedRec['reqParams'] && errRec['reqParams']) savedRec['reqParams'] = errRec['reqParams'];
        if (!savedRec['reqMethod'] && errRec['reqMethod']) savedRec['reqMethod'] = errRec['reqMethod'];
        if (!savedRec['reqOriginalUrl'] && errRec['reqOriginalUrl']) savedRec['reqOriginalUrl'] = errRec['reqOriginalUrl'];
        if (!savedRec['userId'] && errRec['userId']) savedRec['userId'] = errRec['userId'];
        if (!savedRec['userLogin'] && errRec['userLogin']) savedRec['userLogin'] = errRec['userLogin'];
        if (!savedRec['userName'] && errRec['userName']) savedRec['userName'] = errRec['userName'];
        
        savedRec['lastUpdated'] = logDate.toISOString(true);
        currRefs[errRec.refId] = savedRec;
    }

    // Делаем запись в лог
    var logLabel = null;

    if (errRec.error) logLabel = 'ERROR';
    if (!logLabel && errRec.warn) logLabel = 'WARNING';
    if (!logLabel && errRec.info) logLabel = 'INFO';
    if (!logLabel && errRec.debug) logLabel = 'DEBUG';
    if (!logLabel && errRec.trace) logLabel = 'TRACE';
    if (!logLabel) logLabel = 'TRACE';
    errRec.logLabel = logLabel;

    if (errRec.error && typeof errRec.error == 'object') {
        errRec.error = JSON.stringify(errRec.error);
    }
    if (errRec.warn && typeof errRec.warn == 'object') {
        errRec.warn = JSON.stringify(errRec.warn);
    }
    if (errRec.info && typeof errRec.info == 'object') {
        errRec.info = JSON.stringify(errRec.info);
    }
    if (errRec.debug && typeof errRec.debug == 'object') {
        errRec.debug = JSON.stringify(errRec.debug);
    }
    if (errRec.trace && typeof errRec.trace == 'object') {
        errRec.trace = JSON.stringify(errRec.trace);
    }

    errRec.error = trimLongString(errRec.error);
    errRec.warn = trimLongString(errRec.warn);
    errRec.info = trimLongString(errRec.info);
    errRec.debug = trimLongString(errRec.debug);
    errRec.trace = trimLongString(errRec.trace);

    errRec.time = logDate.toISOString(true);

    if (errRec.error) {
        exports.lastError = errRec.time + " " + errRec.error
    }

    if (errRec.warn) {
        exports.lastWarn = errRec.time + " " + errRec.warn
    }
    
    var logMode = "console";
    if (exports.ready == true) {
        logMode = conf.log.logMode;
    }

    // if (logMode == 'entity' && !dbEnt.ready) {
        logMode = "console";
    // }

    // Выходим, если уровень логирования недостаточный
    if (conf.log.logLevel == 'error') {
        if (logLabel == 'TRACE' || logLabel == 'DEBUG' || logLabel == 'INFO' || logtype == 'WARNING') return;
    }

    if (conf.log.logLevel == 'warning') {
        if (logLabel == 'TRACE' || logLabel == 'DEBUG' || logLabel == 'INFO') return;
    }

    if (conf.log.logLevel == 'info') {
        if (logLabel == 'TRACE' || logLabel == 'DEBUG') return;
    }

    if (conf.log.logLevel == 'debug') {
        if (logLabel == 'TRACE') return;
    }

    if (logMode == "console" || logLabel == 'ERROR' || logLabel == 'WARNING' || logLabel == 'INFO') {
        errMsg = null;

        if (logLabel == 'ERROR') errMsg = "\x1b[31m";
        if (logLabel == 'WARNING') errMsg = "\x1b[33m";
        if (logLabel == 'INFO') errMsg = "\x1b[34m";
        if (logLabel == 'DEBUG') errMsg = "\x1b[92m";
        if (logLabel == 'TRACE') errMsg = "\x1b[37m";

        
        if (errRec.moduleCode) {
            errMsg = errMsg + "░░░░░░ (" + errRec.moduleCode + ") " + errRec.time + " " + logLabel;
        } else {
            errMsg = errMsg + "███ " + errRec.time + " " + logLabel;
        }

        if (errRec.error) {
            errMsg = errMsg + ": ";
            if (errRec.code) errMsg = errMsg + errRec.code;
            errMsg = errMsg + ", " + errRec.error;
        }

        if (errRec.warn) errMsg = errMsg + '\n' + errRec.warn;
        if (errRec.info) errMsg = errMsg + '\n' + errRec.info;
        if (errRec.debug) errMsg = errMsg + '\n' + errRec.debug;
        if (errRec.trace) errMsg = errMsg + '\n' + errRec.trace;

        if (logLabel == 'TRACE' || logLabel == 'ERROR') {
            if (errRec.apiStatus) errMsg = errMsg + '\n' + "API returns: " + errRec.apiStatus + ", " + errRec.apiCode + ", " + errRec.apiMessage;
            if (errRec.sysCode) errMsg = errMsg + '\n' + "System Error: " + errRec.sysCode + " " + errRec.sysMessage;
            
            if (errRec.stack && !errRec.hordeStack) errMsg = errMsg + '\n' + errRec.stack;

            if (errRec.hordeStack && Array.isArray(errRec.hordeStack) && errRec.hordeStack.length > 0) {
                errMsg = errMsg + '\n';
                errMsg = errMsg + '***** Application call stack *****';
                for (var i=0; i<errRec.hordeStack.length; i++) {
                    var stackNum = i+1;
                    errMsg = errMsg + "\n#" + stackNum + ". ";
                    if (errRec.hordeStack[i].code) errMsg = errMsg + errRec.hordeStack[i].code + ", ";
                    if (errRec.hordeStack[i].logMessage) errMsg = errMsg + errRec.hordeStack[i].logMessage + ", ";
                    if (errRec.hordeStack[i].caller) errMsg = errMsg + errRec.hordeStack[i].caller;
                }
                errMsg = errMsg + '\n************************';
            }

            var bodyForLog = "";
            if (errRec.reqBody) {
                JSON.parse(JSON.stringify(errRec.reqBody));
                if (errRec.reqOriginalUrl && errRec.reqOriginalUrl.includes("images")) bodyForLog = "{...}";
            }

            var headersForLog = "";
            if (errRec.reqHeaders) {
                JSON.parse(JSON.stringify(errRec.reqHeaders));
                if (errRec.reqHeaders && errRec.reqHeaders["session-id"]) headersForLog["session-id"] = "...";
                if (errRec.reqHeaders && errRec.reqHeaders["app-id"]) headersForLog["app-id"] = "...";
                headersForLog = JSON.stringify(headersForLog);
            }

            if (errRec.reqMethod) errMsg = errMsg + '\n' + "Request data: " + errRec.reqMethod + " " + errRec.reqOriginalUrl + " (" + errRec.reqIp + ") \nHeaders: " + headersForLog + "\nURL Params: " + JSON.stringify(errRec.reqParams) + "\nBody: " + bodyForLog;
        }

        if (logLabel == 'TRACE' || logLabel == 'DEBUG' || logLabel == 'ERROR') {
            var userData = errRec.userId;
            if (errRec['userLogin']) userData = userData + ", " + errRec['userLogin'];
            if (errRec['userName']) userData = userData + ", " + errRec['userName'];

            if (errRec.userId) errMsg = errMsg + '\n' + "User data: " + userData;
        }

        if (errRec.refId) errMsg = errMsg + "\n" + "Ref: " + errRec.refId;

        errMsg = errMsg + "\x1b[0m";

                
        var isFiltered = false;

        if (!isFiltered) {
            console.log(errMsg);
            if (logLabel == 'ERROR' && process.platform == "win32") console.log(errMsg);
        }
    }

    fileLog = {};

    if (errRec.time) fileLog.time = errRec.time;
    if (errRec.logLabel) fileLog.logLabel = errRec.logLabel;
    if (errRec.instance) fileLog.instance = errRec.instance;
    if (errRec.service) fileLog.service = errRec.service;
    if (errRec.code) fileLog.code = errRec.code;

    // fileLog.msg = fileLog.error || fileLog.warn || fileLog.info || errRec.debug || errRec.trace;

    if (logLabel == 'ERROR') fileLog.msg = errRec.error;
    if (logLabel == 'WARNING') fileLog.msg = errRec.warn;
    if (logLabel == 'INFO') fileLog.msg = errRec.info;
    if (logLabel == 'DEBUG') fileLog.msg = errRec.debug;
    if (logLabel == 'TRACE') fileLog.msg = errRec.trace;

    
    /*
    if (errRec.error) fileLog.error = errRec.error;
    if (errRec.warn) fileLog.warn = errRec.warn;
    if (errRec.info) fileLog.info = errRec.info;
    if (errRec.debug) fileLog.debug = errRec.debug;
    if (errRec.trace) fileLog.trace = errRec.trace;
    */

    if (errRec.apiCode) fileLog.apiCode = errRec.apiCode;
    if (errRec.apiStatus) fileLog.apiStatus = errRec.apiStatus;
    if (errRec.apiMessage) fileLog.apiMessage = errRec.apiMessage;
    
    if (errRec.stack) fileLog.stack = errRec.stack;

    if (errRec.sysCode) fileLog.sysCode = errRec.sysCode;
    if (errRec.sysMessage) fileLog.sysMessage = errRec.sysMessage;
    if (errRec.sysCode) fileLog.sysCode = errRec.sysCode;
    if (errRec.sysStack) fileLog.sysStack = errRec.sysStack;

    if (errRec.reportFileName) fileLog.reportFileName = errRec.reportFileName;
    if (errRec.userLogin) fileLog.userLogin = errRec.userLogin;
    if (errRec.lineName) fileLog.lineName = errRec.lineName;
   
    
    // if (errRec.hordeStack) fileLog.hordeStack = errRec.hordeStack;
    // if (errRec.stack && !errRec.hordeStack) errMsg = errMsg + '\n' + errRec.stack;

    var fileStack = "";
    if (errRec.hordeStack && Array.isArray(errRec.hordeStack) && errRec.hordeStack.length > 0) {
        fileStack = fileStack + '***** Application call stack *****';
        for (var i=0; i<errRec.hordeStack.length; i++) {
            var stackNum = i+1;
            fileStack = fileStack + "\n#" + stackNum + ". ";
            if (errRec.hordeStack[i].code) fileStack = fileStack + errRec.hordeStack[i].code + ", ";
            if (errRec.hordeStack[i].logMessage) fileStack = fileStack + errRec.hordeStack[i].logMessage + ", ";
            if (errRec.hordeStack[i].caller) fileStack = fileStack + errRec.hordeStack[i].caller;
        }
        fileStack = fileStack + '\n************************';
    }

    if (fileStack) fileLog.appStack = fileStack;
    if (errRec.reqIp) fileLog.reqIp = errRec.reqIp;
    if (errRec.reqBody) fileLog.reqBody = errRec.reqBody;
    if (errRec.reqHeaders) fileLog.reqHeaders = errRec.reqHeaders;
    if (errRec.reqParams) fileLog.reqParams = errRec.reqParams;
    if (errRec.reqMethod) fileLog.reqMethod = errRec.reqMethod;
    if (errRec.reqOriginalUrl) fileLog.reqOriginalUrl = errRec.reqOriginalUrl;
    if (errRec.moduleCode) fileLog.moduleCode = errRec.moduleCode;

    if (errRec.userId) fileLog.userId = errRec.userId;
    if (errRec.userLogin) fileLog.userLogin = errRec.userLogin;
    if (errRec.userName) fileLog.userName = errRec.userName;

    if (errRec.refId) fileLog.refId = errRec.refId;

    fileLog.usersSeen = [];

    if (!errRec.refId) {
        fileLog.refId = uuidBase62.v4();
    }

    if (errRec.prodOrderNumber) fileLog.prodOrderNumber = errRec.prodOrderNumber;
    if (errRec.orderId) fileLog.orderId = errRec.orderId;
    if (errRec.reportId) fileLog.reportId = errRec.reportId;

    fileLog = removeLogEscaping(fileLog);

    if (logMode == "file") {
        if (logLabel == 'ERROR') exports.flog.error(JSON.stringify(fileLog));
        if (logLabel == 'WARNING') exports.flog.warn(JSON.stringify(fileLog));
        if (logLabel == 'INFO') exports.flog.info(JSON.stringify(fileLog));
        if (logLabel == 'DEBUG') exports.flog.debug(JSON.stringify(fileLog));
        if (logLabel == 'TRACE') exports.flog.trace(JSON.stringify(fileLog));
    }

    if (logMode == 'fluent') {
        // Подготавливаем запись для fluent
        fluent.emit(logLabel, fileLog);
    }

 

    var bufCode = moment(fileLog.time).local().format('YYYYMMDD');

    //console.log(logEntName);
    //console.log(fileLog);

    if (!logBuf[bufCode]) logBuf[bufCode] = [];

    var ln = logBuf[bufCode].length;

    if (ln >= logBufLimit) {
        console.log("Переполнение буфера записи логов в БД, старые логи в буфере будут затираться новыми");
        logBuf[bufCode].shift();
    }

    fileLog.time = moment(fileLog.time).toDate();

    logBuf[bufCode].push(fileLog);

    return errObject;
}

/*
var logRec = {
    code: 'E_SalespointNotFound',
    error: 'Ошибка при создании точки продаж',
    warn: null,
    info: null,
    debug: 'Отладочная информация',
    trace: 'Данные трассировки',
    sysErr: null,
    refId: 'testRef',
    userId: 41,
    req: null
}

log.rec(logRec);
*/

exports.error = function (msg, sysErr=null, refId = null) {
    return exports.rec({ error: msg, sysErr: sysErr, refId: refId });
}

exports.warn = function (msg, refId = null) {
    exports.rec({ warn: msg, refId: refId });
}

exports.info = function (msg, refId = null) {
    exports.rec({ info: msg, refId: refId });
}

exports.debug = function (msg, refId = null) {
    exports.rec({ debug: msg, refId: refId });
}

exports.trace = function (msg, refId = null) {
    exports.rec({ trace: msg, refId: refId });
}

function statsClean() {
    var nowDate = moment();

    for (var i=0; i<exports.currStats.length; i++) {
        var started = exports.currStats[i]['statStart'];
        var dateDiffSec = nowDate.diff(moment(started), 'seconds');

        if (dateDiffSec >= 1800) {
            exports.trace("Удаление незакрытого счетчика производительности: " + exports.currStats[i]['statId'] + " (" + exports.currStats[i]['statCounter'] + ") " + ". Данные: " + JSON.stringify(exports.currStats[i]['statData']));
            exports.currStats.splice(i, 1);
            i--;
        }
    }

    for (var r in currRefs) {
        if (currRefs.hasOwnProperty(r)) {
            var lastUpdated = currRefs[r]['lastUpdated'];
            var dateDiffSec = nowDate.diff(moment(lastUpdated), 'seconds');
            if (dateDiffSec >= 600) {
                delete currRefs[r];
            }
        }
    }

}

exports.statStart = function (counter, data, ref) {
    
    // Генерируем уникальный id и сохраняем данные в массив
    var newStatId = uuidBase62.v4(); //uuidv4();

    var statObj = {
        statId: newStatId,
        statData: data,
        statCounter: counter,
        statStart: moment().toISOString(true),
        statRef: ref
    }

    exports.currStats.push(statObj);
    return newStatId;
}

var lastStats = {}
exports.lastStats = lastStats;

exports.statAverage = function (statCounter) {
    var ret = 0;
    if (lastStats[statCounter] && Array.isArray(lastStats[statCounter]) && lastStats[statCounter].length > 0) {
        var countersSum = 0;
        for (var i=0; i<lastStats[statCounter].length; i++) {
            countersSum = countersSum + lastStats[statCounter][i];
        }
        var avg = countersSum / lastStats[statCounter].length;
        // ret = avg;
        // ret = Math.round(avg * 100) / 100;
        ret = avg.toFixed(4);
    }
    return ret;    
}

exports.statEnd = function (statId, print=false) {
    // Ищем в массиве счетчик и завершаем его
    var foundInd = null;
    var nowDate = moment();

    var currCounter = null;

    for (var i=0; i<exports.currStats.length; i++) {
        if (statId == exports.currStats[i]['statId']) {
            foundInd = i;
            currCounter = exports.currStats[i]['statCounter'];
            break;
        }
    }

    if (foundInd==null) {
        exports.error("Счетчик " + statId + " не найден в массиве счетчиков");
        return;
    }

    // Делаем замер времени в секундах
    //var dateDiffSec = nowDate.diff(moment(exports.currStats[foundInd]['statStart']), 'seconds');
    var dateDiffSec = nowDate.diff(moment(exports.currStats[foundInd]['statStart']));
    var dateDiffMs = dateDiffSec;
    dateDiffSec = dateDiffSec / 1000;

    if (!lastStats[currCounter]) lastStats[currCounter] = [];
    lastStats[currCounter].push(dateDiffSec);
    if (lastStats[currCounter].length > 10) lastStats[currCounter].shift();

    // exports.trace("Счетчик [" + exports.currStats[foundInd]['statCounter'] + "]: " + dateDiffSec + " сек.");
    dateDiffSec = Math.round(dateDiffSec * 100) / 100;

    var logData = {
        counter: exports.currStats[foundInd]['statCounter'],
        started: exports.currStats[foundInd]['statStart'],
        finished: nowDate.toISOString(true),
        durationSec: dateDiffSec,
        durationMs: dateDiffMs,
        data: exports.currStats[foundInd]['statData'],
        ref: exports.currStats[foundInd]['statRef'],
        instance: conf.main.instanceName,
        service: conf.main.serviceName,
        logLabel: 'STAT'
    }

    if (conf.log.logMode == "file") {
        exports.slog.info(JSON.stringify(logData));
    }

    if (print || conf.log.printCounters) {
        console.log(logData.counter + ": " + dateDiffMs / 1000);
    }

    if (conf.log.logMode == 'fluent') {
        fluent.emit('STAT', logData);
    }

    // Удаляем счетчик из массива
    exports.currStats.splice(foundInd, 1);
}

exports.statCancel = function (statId) {
    var foundInd = null;

    for (var i=0; i<exports.currStats.length; i++) {
        if (statId == exports.currStats[i]['statId']) {
            foundInd = i;
            break;
        }
    }

    exports.currStats.splice(foundInd, 1);
}

exports.statFixed = function(counter, started, durationSec, data) {

    var logData = {
        counter: counter,
        started: started,
        durationSec: durationSec,
        data: data,
        instance: conf.main.instanceName,
        service: conf.main.serviceName,
        logLabel: 'STAT'
    }
   
    if (conf.log.logMode == "file") {
        exports.slog.info(JSON.stringify(logData));
    }

    if (conf.log.logMode == 'fluent') {
        fluent.emit('STAT', logData);
    }
}


exports.ApiErr = class extends Error {
    constructor (errCode) {
        super(errCode);
        Error.captureStackTrace(this, exports.rec);
    }
};


