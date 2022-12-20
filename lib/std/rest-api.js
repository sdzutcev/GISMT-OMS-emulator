var conf = require('./conf.js');
var log = require('./log.js');
var errors = require('./errors.js');
var Error = errors.Error;

const uuidBase62 = require('uuid-base62');

var express = require("express");
var bodyParser = require("body-parser");
var fs = require("fs");
var path = require("path");
var xssFilters = require('xss-filters');
var formidable = require('formidable');
var validator = require('validator');
var favicon = require('serve-favicon')

exports.ready = false;
exports.app = null;

exports.apiFuncs = {};
exports.apiMethods = {};

exports.init = async function() {
    return new Promise((resolve, reject) => {
        try {

            if (!conf.restApi || !conf.restApi.restApiEnabled) {
                
                log.warn("Конфигурация API не найдена и модуль работы с API отключен");

                exports.ready = false;
                resolve();
                return;
            }

            log.debug("Инициализация REST API...");

            if (!conf.restApi.apiMethods || !Array.isArray(conf.restApi.apiMethods) || conf.restApi.apiMethods.length == 0) {
                new Error("E_ConfigurationError", "Ошибка при инициализации REST API: REST API включен, но не найдены методы API").log();
                reject("Ошибка при инициализации REST API: REST API включен, но не найдены методы API");
                return;
            }

            exports.app = express();

            exports.app.use(bodyParser.urlencoded({ extended: true }));
            exports.app.use(bodyParser.json({ limit: "100mb" }));
            exports.app.use(logRequestStart);

            // Дефолтная страница сервиса
            exports.app.get("/", function(req, res) {
                var contents = getDefaultPage("default-root.html", null);
                res.send(contents);
            });

            var faviconPath = path.join(conf.main.staticPath, 'favicon.ico');

            if (fs.existsSync(path)) {
                exports.app.use(favicon(faviconPath));
            } else {
                exports.app.use(function (req, res, next) {
                    if (req.originalUrl === '/favicon.ico') {
                        res.status(204).json({});
                    } else {
                        next();
                    }
                });
            }

            exports.app.use(function (req, res, next) {
                //res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
                var allowOriginHeader = '*';
                if (conf.restApi.allowOriginHeader) allowOriginHeader = conf.restApi.allowOriginHeader;

                res.setHeader('Access-Control-Allow-Origin', allowOriginHeader);
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
                res.setHeader('Access-Control-Allow-Headers', 'x-requested-with,content-type,session-id,app-id,content-length,reference-id,lang-id');
                res.setHeader('Access-Control-Allow-Credentials', true);
                res.setHeader('Access-Control-Expose-Headers', 'reference-id');

                if (req.method == 'OPTIONS') {
                    res.status(200).send();
                }
                else {
                    next();
                }
            });

            initApi(function(err) {
                if (err) {
                    new Error("E_ConfigurationError", "Ошибка при инициализации REST API: " + err).log();
                    reject("Ошибка при инициализации REST API: " + err);
                    return;
                }

                exports.app.use(function(req, res, next) {
                    var allowOriginHeader = '*';
                    if (conf.restApi.allowOriginHeader) allowOriginHeader = conf.restApi.allowOriginHeader;
                        res.setHeader('Access-Control-Allow-Origin', allowOriginHeader);

                    // Пытаемся обработать новые роуты, добавленные в рантайме
                    var urlFound = false;

                    for(var i=0; i<conf.restApi.apiMethods.length; i++) {
                        let methodObj = conf.restApi.apiMethods[i];
                
                        if (methodObj.method == req.method && methodObj.url == req._parsedUrl.pathname) {
                            urlFound = true;
                            log.trace("Вызов динамически добавленного метода API " + methodObj.url);
                            invokeApi(req, res, methodObj);
                            break;
                        }
                    }

                    if (!urlFound) {
                        // res.status(404).json({ code: 'E_NotFound', message: errors.getErrorUserMessage('E_NotFound') });
                        retApiError('E_NotFound', req, res, null);
                    }

                });
                
                exports.app.use(function(err, req, res, next) {
                    var allowOriginHeader = '*';
                    if (conf.restApi.allowOriginHeader) allowOriginHeader = conf.restApi.allowOriginHeader;
                        res.setHeader('Access-Control-Allow-Origin', allowOriginHeader);

                    new Error("E_IncorrectParams", "Ошибка парсинга входных параметров: " + err).log();
                    retApiError('E_IncorrectParams', req, res, null);
                });

                // Параметры по умолчанию
                var apiTcpPort = 8080;
                var apiBindIp = "0.0.0.0";

                if (conf.restApi.apiTcpPort) {
                    apiTcpPort = conf.restApi.apiTcpPort;
                };

                if (conf.restApi.apiBindIp) {
                    apiBindIp = conf.restApi.apiBindIp;
                };

                exports.app.listen(apiTcpPort, apiBindIp);
                log.info("Инициализация REST API завершена успешно. Сервис начал принимать запросы по адресу и порту " + apiBindIp + ": " + apiTcpPort);
                exports.ready = true;
                resolve();
            });

        } catch (err) {
            console.log(err)
            reject(err);
        }
    });
}

const logRequestStart = (req, res, next) => {

    if (req.originalUrl) {
        if (req.originalUrl.includes("/favicon.ico")) {
            next();
            return;
        }
    }

    var refId = req.header('Reference-Id') || req.header('reference-id');
    if (refId == null) {
        refId = uuidBase62.v4();
        req.headers['reference-id'] = refId;
    }

    var appId = req.header('App-Id') || req.header('app-id') || req.header('App-id');
    if (appId) {
        // Ищем в конфигах id приложений и конвертируем в нормальное имя
        if (conf.restApi.apps && typeof conf.restApi.apps == 'object' && conf.restApi.apps[appId]) {
            req.headers['app-id'] = conf.restApi.apps[appId];
        }
    }


    var dataForLogs = JSON.stringify(req['body']);

    if (req.originalUrl) {
        if (req.originalUrl.includes("images") || req.originalUrl.includes("files")) {
            dataForLogs = "{...}";
        }
    }

    var headersForLog = JSON.parse(JSON.stringify(req['headers']));
    if (req['headers'] && req['headers']["session-id"]) headersForLog["session-id"] = "...";
    // if (req['headers'] && req['headers']["caller-token"]) headersForLog["caller-token"] = "...";
    headersForLog = JSON.stringify(headersForLog);

    dataForLogs = xssFilters.inHTMLData(dataForLogs);

    var qIp = req.headers["X-Forwarded-For"] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;

    var logMsg = "Запрос: " + req.method + " " + req.originalUrl + ", Headers: " + headersForLog + ", Body: " + dataForLogs + ". IP: " + qIp;

    log.trace(logMsg, refId);

    if (!exports.ready) {
        log.error("Сервер не может обработать запрос в настоящее время", null, refId);
        res.status(500).send();
    } else {
        next();
    }

}

function getDefaultPage(htmlFile, callback) {
    var contents;

    var htmlFilePath = path.join(conf.main.templatesPath, "html", htmlFile);

    try {
        contents = fs.readFileSync(htmlFilePath, "utf8");
    } catch (err) {
        var errMsg = "Файл html " + htmlFilePath + " не найден";
        log.warn(errMsg);
        contents = errMsg;
    }

    return contents;
}

function trimLongString(str) {
    var ret = str;

    if (str && typeof str === 'string' && str.length > 2000) {
        var cutLen = str.length-2000;
        ret = str.substring(0, 1000) + '\n................(' + cutLen + ')\n' + str.substring(str.length - 1000);
    }

    return ret;
}

function retApiError(apiErr, req, res, refId) {

    var errCode = apiErr;
    var isErrorObj = false;

    if (typeof apiErr == "object") {
        // log.warn(apiErr.stack[0]);
        if (apiErr.stack && apiErr.stack[0] && apiErr.stack[0].code) {
            errCode = apiErr.stack[0].code;
            isErrorObj = true;
        }
    }

    var retStatus = errors.getErrorHttpStatus(errCode);
    if (!retStatus) retStatus = 500;
    var errMsg = errors.getErrorUserMessage(errCode);

    var bodyForLog = JSON.stringify(req['body']);
    bodyForLog = trimLongString(bodyForLog);

    var logError = true;
    if (errCode == 'E_NotFound' && conf.restApi && conf.restApi.badUrls && Array.isArray(conf.restApi.badUrls)) {
        for (var i=0; i<conf.restApi.badUrls.length; i++) {
            var bu = conf.restApi.badUrls[i].toLowerCase();
            var url = req.originalUrl.toLowerCase();

            if (url.includes(bu)) {
                log.trace("Запрос проигнорирован и не залогирован как ошибка, так как url " + url + " входит в список плохих запросов");
                logError = false;
            }
        }
    }



    if (req.originalUrl) {
        if (req.originalUrl.includes("images") || req.originalUrl.includes("files")) {
            bodyForLog = "{...}";
        }
    }

    var errLogMsg = "Ошибка выполнения API запроса " + req.method + " " + req.originalUrl + ".\n" + "Headers: " + JSON.stringify(req['headers']) + 
        ", Body: " + bodyForLog + ". Результат: (" + retStatus + ") " + errCode + ", " + errMsg

    if (logError) {
        if (isErrorObj) {
            var e = new Error(apiErr, errLogMsg, refId).log();
        } else {
            log.error(errLogMsg, null, refId);
        }
    }

    res.status(retStatus).json({ code: errCode, message: errMsg });
}

function verifyParamsList(paramsObj, methodObj, paramListName, refId) {
    retObj = {};

    if (methodObj[paramListName]) {
        for (var i=0; i < methodObj[paramListName].length; i++) {
            var confParam = methodObj[paramListName][i];

            var param = null;
            var paramFin = null;

            for (var ind in paramsObj) {
                if (ind == confParam['name']) {
                    param = paramsObj[ind];
                    break;
                }
            }

            try {
                paramFin = verifyParam(param, confParam, methodObj, refId);
            } catch(err) {
                var logMsg = "Параметр не прошел проверку формата. Метод: " + methodObj['funcName'] + ". Параметр: " + confParam['name'] + ". Значение параметра: " +
                    xssFilters.inHTMLData(param) + ". Требуемый формат: " + JSON.stringify(confParam);
                var errObj = new Error(err, logMsg, refId);
                throw errObj;
                return;
            }

            if (param != null) {
                retObj[confParam['name']] = paramFin;
            }
        }
    }
    return retObj;
}

function verifyParam(paramVal, confParam, methodObj, refId) {

    var retParam = null;
    var paramChecked = false;

    // Проверка на обязательность параметра
    if (paramVal == null && confParam['required'] == true) {
        var logMsg = "Вызов метода без указания обязательного параметра. Метод: " + methodObj['funcName'] + ". Отсутствующий параметр: " + confParam['name'];
        var errObj = new Error("E_IncorrectParams", logMsg, refId);
        throw errObj;
    }

    // Проверка параметра
    if (paramVal != null) {
        var cType = confParam['type'];

        if (!['integer', 'string', 'string-asci', 'string-num', 'uuid62', 'float', 'money', 'date', 'object', 'array', 'boolean', 'phone', 'email', 'image', 'file', 'html'].includes(cType)) {
            var logMsg = 'В конфигурации определен параметр неизвестного типа: ' + cType;
            var errObj = new Error("E_IncorrectParams", logMsg, refId);
            throw errObj;
        }

        var cLen = confParam['maxLen'];
        // Конвертируем параметр в строку
        var paramValStr = paramVal.toString();
        if (Array.isArray(paramVal) || typeof paramVal === 'object' || Array.isArray(paramVal)) {
            paramValStr = JSON.stringify(paramVal);
        }

        // Проверяем длину объекта в строковом выражении
        if (paramValStr.length > cLen) {
            var logMsg = "Вызов метода с параметром, превышающим допустимую длину. Метод: " + methodObj['funcName'] + 
                ". Параметр: " + confParam['name'] + ". Фактическая длина: " + paramValStr.length + ". Допустимая длина: " + cLen;
            var errObj = new Error("E_IncorrectParams", logMsg, refId);
            throw errObj;
        }

        // Проверяем параметр на XSS (внедрение JavaScript кода)
        /*
        if (paramValStr != xssFilters.inHTMLData(paramValStr)) {
            var logMsg = "Обнаружена попытка внедрения XSS. Метод: " + methodObj['funcName'] + ". Параметр: " + confParam['name'] + ". Результат XSS обработчика: " + xssFilters.inHTMLData(paramValStr);
            var errObj = new Error("E_IncorrectParams", logMsg, refId);
            throw errObj;
        }
        */

        // Проверяем тип параметра (и приводим к нужному типу или формату при необходимости)
        if (cType == 'integer') {
            // Проверка
            if (!validator.isInt(paramValStr)) throw new Error('E_IncorrectParams', null, refId);
            // Приведение
            retParam = parseInt(paramValStr);
            paramChecked = true;
        }

        if (cType == 'string') {
            // Проверка (может быть любая строка)
            // Приведение
            //retParam = xssFilters.inHTMLData(paramValStr);
            retParam = paramValStr;
            paramChecked = true;
        }

        if (cType == 'html') {
            retParam = paramValStr;
            paramChecked = true;
        }

        if (cType == 'string-asci') {
            // Проверка (Строка с символами из ACSI)
            if (!validator.isAscii(paramValStr)) throw new Error('E_IncorrectParams', null, refId);
            // Приведение
            // retParam = xssFilters.inHTMLData(paramValStr);
            retParam = paramValStr;
            paramChecked = true;
        }

        if (cType == 'uuid62') {
            // Проверка (Строка с символами из ACSI)
            if (!validator.isAscii(paramValStr) || paramValStr.length != 22) throw new Error('E_IncorrectParams', null, refId);
            // Приведение
            // retParam = xssFilters.inHTMLData(paramValStr);
            retParam = paramValStr;
            paramChecked = true;
        }

        if (cType == 'string-num') {
            // Проверка (Строка с числами)
            if (!validator.isInt(paramValStr, { allow_leading_zeroes: true })) throw new Error('E_IncorrectParams', null, refId);
            // Приведение
            // retParam = xssFilters.inHTMLData(paramValStr);
            retParam = paramValStr;
            paramChecked = true;
        }

        if (cType == 'float') {
            // Проверка (число с плавающей точкой)
            if (!validator.isFloat(paramValStr)) throw new Error('E_IncorrectParams', null, refId);
            // Приведение (не округляем, берем как есть)
            retParam = parseFloat(paramValStr);
            paramChecked = true;
        }

        if (cType == 'money') {
            // Проверка (число с плавающей точкой)
            if (!validator.isFloat(paramValStr)) throw new Error('E_IncorrectParams', null, refId);
            // Приведение (округляем до двух знаков после запятой)
            retParam = parseFloat(paramValStr);
            retParam = Math.round(retParam * 100) / 100;
            paramChecked = true;
        }

        if (cType == 'date') {
            // Проверка (ISO дата)
            if (!validator.isISO8601(paramValStr, { strict: true })) throw new Error('E_IncorrectParams', null, refId);
            // Приведение (Конвертим в moment() и обратно)
            //retParam = moment(paramValStr).format('YYYY-MM-DD');
            retParam = paramValStr;
            paramChecked = true;
        }

        if (cType == 'object') {

            // Проверка (на JSON)
            if (!validator.isJSON(paramValStr)) throw new Error('E_IncorrectParams', null, refId);
            // Приведение (конвертим в объект и проверяем, объект ли это)
            // retParam = JSON.parse(xssFilters.inHTMLData(paramValStr));

            retParam = JSON.parse(paramValStr);

            if (Array.isArray(retParam)) throw new Error('E_IncorrectParams', null, refId);

            paramChecked = true;
        }

        if (cType == 'array') {
            // Проверка (на JSON)
            if (!validator.isJSON(paramValStr)) throw new Error('E_IncorrectParams', null, refId);
            // Приведение (конвертим в объект и проверяем, объект ли это)
            // retParam = JSON.parse(xssFilters.inHTMLData(paramValStr));
            retParam = JSON.parse(paramValStr);

            if (!Array.isArray(retParam)) throw new Error('E_IncorrectParams', null, refId);
            paramChecked = true;
        }

        if (cType == 'boolean') {
            // Проверка
            if (!['1', 'true', '0', 'false'].includes(paramValStr)) throw new Error('E_IncorrectParams', null, refId);
            // Приведение
            retParam = validator.toBoolean(paramValStr, true);
            paramChecked = true;
        }

        if (cType == 'phone') {
            // Проверка (также как string-num, только убираем + в начале, если он есть)
            if (paramValStr.startsWith("+")) paramValStr = paramValStr.substring(1);
            if (!validator.isInt(paramValStr, { allow_leading_zeroes: true })) throw new Error('E_IncorrectParams', null, refId);

            // Приведение
            retParam = paramValStr;
            paramChecked = true;
        }

        if (cType == 'email') {
            // Проверка
            if (!validator.isEmail(paramValStr)) throw new Error('E_IncorrectParams', null, refId);
            // Приведение
            // retParam = xssFilters.inHTMLData(paramValStr);
            retParam = paramValStr;

            paramChecked = true;
        }

        if (cType == 'image' || cType == 'file') {
            // Проверка
            // if (!validator.isEmail(paramValStr)) throw new Error('E_IncorrectParams', null, refId);
            // Приведение
            // retParam = xssFilters.inHTMLData(paramValStr);
            paramChecked = true;
        }

        if (!paramChecked) {
            log.error("Параметр не проверен ни одной из функций валидации. Метод: " + methodObj['funcName'] + ". Параметр: " + JSON.stringify(confParam) + ". Ref: " + refId);
            throw 'E_IncorrectParams';
            return;
        }
    }

    return retParam;
}

function parseMultipartForm(req) {
    return new Promise((resolve, reject) => {

        var form = new formidable.IncomingForm();
        form.encoding = 'utf-8';
    
        form.parse(req, function (err, fields, files) {
            if (err) {
                reject(err);
                return;
            }

            var ret = {
                fields: fields,
                files: files
            }

            //log.info("######################");
            //log.info(ret.fields);
            //log.info("######################");
            //log.info(ret.files);
            
            resolve(ret);
        });
    });
}

async function invokeApi(req, res, methodObj) {

    // log.info("HERE");


    // Проверяем, остался ли этот метод в конфиге, или уже удален
    var urlFound = false;

    for(var i=0; i<conf.restApi.apiMethods.length; i++) {
        let methodObj = conf.restApi.apiMethods[i];

        if (methodObj.method == req.method && methodObj.url == req.route.path) {
            urlFound = true;
            break;
        }
    }

    if (!urlFound) {
        retApiError('E_NotFound', req, res, null);
        return;
    }

    // Проверка reference id
    var refId = req.header('Reference-Id') || req.header('reference-id');
    if (refId == null) {
        refId = uuidBase62.v4();
    };

    var urlParams = {};
    var headerParams = {};
    var bodyParams = {};

    if (req.query && typeof req.query === 'object') {
        for (var r in req.query) {
            req.params[r] = req.query[r];
        }
    }

    try {
        if (req.params && typeof req.params === 'object') {

            urlParams = verifyParamsList(req.params, methodObj, 'urlParams', refId);
        }
    } catch(err) {
        var e = new Error(err, "Ошибка проверки параметров API urlParams", refId);
        //retApiError('E_IncorrectParams', req, res, refId);
        retApiError(e, req, res, refId);
        return;
    }

    var userId = req.params['userId'];

    var multipartFormParams = null;

    if (methodObj['isMultipartForm']) {
        var formData = null;

        try {
            formData = await parseMultipartForm(req);

            log.trace("Данные формы: ");
            log.trace(formData);

        } catch(err) {
            var e = new Error(err, "Ошибка проверки параметров API MultipartForm", refId);
            retApiError(e, req, res, refId);
            return;
        }

        if (formData && formData.fields) {
            multipartFormParams = formData.fields;
            if (formData.files) {
                multipartFormParams.uploadedFiles = formData.files;
            }
        }
    }


    var logRec = {
        trace: "Запуск метода API " + methodObj['funcName'] + " (" + methodObj['url'] + ")",
        sysErr: null,
        refId: refId,
        req: req
    }
    if (userId) logRec.userId = userId;

    log.rec(logRec);

    var dataForLogs = JSON.stringify(req.params) + ", " + JSON.stringify(req.body);
    var metricName = methodObj['metric'];

    if (methodObj['funcName'] == 'createSession') {
        dataForLogs = req.body['userLogin'];
        if (req.body["tempToken"]) {
            metricName = metricName + '-2';
        }
    }

    dataForLogs = xssFilters.inHTMLData(dataForLogs);

    var statId = log.statStart(metricName, dataForLogs, refId);

    try {
        if (req.body && typeof req.body === 'object') {

            var par = req.body;
            if (multipartFormParams) {
                par = multipartFormParams;
            }

            bodyParams = verifyParamsList(par, methodObj, 'bodyParams', refId);

            if (multipartFormParams && multipartFormParams.uploadedFiles) bodyParams.uploadedFiles = multipartFormParams.uploadedFiles;
        }

        if (req.headers && typeof req.headers === 'object') {
            headerParams = verifyParamsList(req.headers, methodObj, 'headerParams', refId);
        }
    } catch(err) {
        log.statCancel(statId);
        var e = new Error(err, "Ошибка проверки параметров API bodyParams", refId);
        retApiError(e, req, res, refId);
        return;
    }


   

    // Собираем и проверяем входные параметры
    var qIp = req.headers["X-Forwarded-For"] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;
    headerParams['user-ip'] = qIp;

    // Проверка доступа по app-id
    var accessAllowed = false;

    var apiFuncName = methodObj['funcName'];
    var appId = req.headers["app-id"];
    if (appId) headerParams['app-id'] = appId;

    if (req.headers["device-id"]) headerParams['device-id'] = req.headers["device-id"];
    if (req.headers["lang-id"]) headerParams['lang-id'] = req.headers["lang-id"];
    if (req.headers["session-id"]) headerParams['session-id'] = req.headers["session-id"];
    if (req.headers["clienttoken"]) headerParams['clienttoken'] = req.headers["clienttoken"];

    // Если параметра conf.restApi.appsAccess нет, то разрешаем запуск всех методов
    if (!conf.restApi.appsAccess) {
        accessAllowed = true;
    }
    
    // Проверяем, есть ли этот метод в режиме доступа *
    if (!accessAllowed) {
        var starArr = conf.restApi.appsAccess['*'];
        if (starArr && starArr.includes(apiFuncName)) {
            accessAllowed = true;
        }
    }

    // Проверям доступ к методу
    if (!accessAllowed && appId) {
        var appArr = conf.restApi.appsAccess[appId];
        if (appArr && appArr.includes(apiFuncName)) {
            accessAllowed = true;
        }
    }

    if (!accessAllowed) {
        var e = new Error('E_MethodNotAllowed', "У приложения " + appId + " нет доступа к вызову функции API " + apiFuncName, refId);
        retApiError(e, req, res, refId);
        return;
    }

    log.trace("Завершена проверка и конвертация параметров для вызова API метода " + methodObj['funcName'] + " (" + methodObj['url'] + ")" + ". urlParams: " + JSON.stringify(urlParams), refId);

    // Вызываем метод API
    
    if (!exports.apiFuncs[apiFuncName]) {
        log.statCancel(statId);
        var e = new Error('E_ConfigurationError', "Функция API " + apiFuncName + " не найдена", refId);
        //retApiError('E_ConfigurationError', req, res, refId);
        retApiError(e, req, res, refId);
        return;
    }

    var apiFunc = exports.apiFuncs[apiFuncName];

    var callParams = {
        res: res,
        req: req,
        methodObj: methodObj,
        statId: statId
    };

    // headerParams['%call%'] = callParams;
    var sessId = headerParams['session-id'];

    apiFunc(urlParams, bodyParams, headerParams, callParams, refId, function(err, data={}, retCode=200) {
        if (err) {
            log.statCancel(statId);
            var e = new Error(err, "Ошибка при вызове API метода: " + apiFuncName, refId);
            retApiError(e, req, res, refId);
            return;
        }

        if (!data) data = {};

        var retInfo = null;
        if (Array.isArray(data)) {
            retInfo = 'Массив из ' + data.length + ' записей. Первая запись: ' + JSON.stringify(data[0]);
        } else {

            if (data['image'] || data['form']) {
                retInfo = '{...}'
            } else {
                retInfo = JSON.stringify(data);
            }

        }

        if (!data['%queued%']) {
            log.statEnd(statId);

            log.trace("Завершен запуск метода API " + methodObj['funcName'] + " (" + methodObj['url'] + "). " + "HTTP статус: " + retCode + ". Данные, вернувшиеся клиенту: " + retInfo, refId);

            var newSessId = headerParams['session-id'];

            //if ((sessId && newSessId && sessId != newSessId) || (!sessId && newSessId)) {
            //    res.header('session-id', newSessId);
            //}

            if (newSessId) {
                res.header('session-id', newSessId);
            }

            if (data['%file%']) {
                res.sendFile(data['%file%']);
            } else {
                res.status(retCode).json(data);
            }
        }

    }).catch(function(err) {
        log.statCancel(statId);
        var e = new Error(err, "Ошибка при вызове API метода: " + apiFuncName, refId);
        retApiError(e, req, res, refId);
        return;
    });

}

function initApi(callback) {

    for(var i=0; i<conf.restApi.apiMethods.length; i++) {
        let methodObj = conf.restApi.apiMethods[i];

        if (methodObj['method'] == 'GET') {
            exports.app.get(methodObj['url'], function(req, res) {
                invokeApi(req, res, methodObj);
            });
        }

        if (methodObj['method'] == 'POST') {
            exports.app.post(methodObj['url'], function(req, res) {
                invokeApi(req, res, methodObj);
            });
        }

        if (methodObj['method'] == 'PUT') {
            exports.app.put(methodObj['url'], function(req, res) {
                invokeApi(req, res, methodObj);
            });
        }

        if (methodObj['method'] == 'DELETE') {
            exports.app.delete(methodObj['url'], function(req, res) {
                invokeApi(req, res, methodObj);
            });
        }
    }

    callback();
}