var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var _ = require('underscore');
var lodash = require('lodash');
const JSON5 = require('json5');

var env = require('./env.js');


exports.conf = {};
var confOrig = {};

exports.shutdown = false;

exports.init = async function() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("Инициализация конфигурации...");

            mkdirp.sync(env['CONFIG_FILES']);
            mkdirp.sync(env['DATA_FILES']);
            mkdirp.sync(env['TEMP_FILES']);
            mkdirp.sync(env['LOG_FILES']);
            mkdirp.sync(env['TEMPLATES_FILES']);
            mkdirp.sync(env['STATIC_FILES']);
            mkdirp.sync(env['MODULES_FILES']);

            await loadConfigSync();

            console.log("Инициализация конфигурации успешно завершена");
            resolve();

        } catch (err) {
            console.log("Инициализация конфигурации завершена с ошибкой", err);
            reject('E_ConfigurationError');
        }
    });
}

loadConfigSync = function() {
    return new Promise((resolve, reject) => {
        loadConfig(function(err, data) {
            if(err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

async function loadConfig(callback) {

    var confFiles = null;

    try {
        var confFiles = getFiles(env['CONFIG_FILES']);
    } catch(err) {
        setTimeout(loadConfig, 10000);
        console.log("Ошибка при чтении файлов конфигурации: " + err);
        if (callback) callback(null, null);
        return;
    }

    var newConfig = {};
    var isReadError = false;

    if (!confFiles || !Array.isArray(confFiles) || confFiles.length == 0) {
        console.log("Не удалось получить файлы конфигурации");
    } else {

        // Пробегаем по массиву файлов и загружаем их в оперативную память
        var isConfChanged = false;
        for (var cf=0; cf<confFiles.length; cf++) {
            // Проверяем расширение файла. Если это .json или json5, то грузим его в память
            var fileExt = path.extname(confFiles[cf].name).toLowerCase();

            if (fileExt != '.json' && fileExt != '.json5') continue;

            // Получаем имя файла
            var currFilePath = confFiles[cf].name;
            var currFileName = path.basename(currFilePath);

            // Убираем расширение файла
            var currConfigName = currFileName.replace(/\.[^/.]+$/, "");

            // Если файл в подкаталоге, то добавляем подкаталог в код конфига
            if (confFiles[cf].subDir) currConfigName = confFiles[cf].subDir + '/' + currConfigName;

            // Считываем и парсим .json файл
            var currConfig = null;
            try {
                var fRaw = fs.readFileSync(currFilePath, 'utf8');

                if (fileExt == ".json") {
                    currConfig = JSON.parse(fRaw);
                } else {
                    currConfig = JSON5.parse(fRaw);
                }

                newConfig[currConfigName] = currConfig;
            }
            catch (err) {
                isReadError = true;
                console.error('Не удалось прочитать конфиг файл: ' + currFilePath + '. Ошибка: ' + err);
            }
        }

        if (!isReadError && newConfig && Object.keys(newConfig).length > 0) {
            if (Object.keys(confOrig).length == 0 || !_.isEqual(confOrig, newConfig)) {
                confOrig = newConfig;
                var confOrigClone = JSON.parse(JSON.stringify(confOrig));
                // Пробегаем по объектам/файлам конфигурации и присваиваем их модулю
                for (var cn in confOrigClone) {
                    exports[cn] = confOrigClone[cn];
                }

                console.log('Загружена или обновлена конфигурация сервиса');

                
                if (!exports.main) exports.main = {};
                exports.main.configPath = env['CONFIG_FILES'];
                exports.main.tempPath = env['TEMP_FILES'];
                exports.main.dataPath = env['DATA_FILES'];
                exports.main.logsPath = env['LOG_FILES'];
                exports.main.templatesPath = env['TEMPLATES_FILES'];
                exports.main.staticPath = env['STATIC_FILES'];
                exports.main.modulesPath = env['MODULES_FILES'];

                if (env['TEST_MODE'] && (env['TEST_MODE'] == 'true' || env['TEST_MODE'] == 'Y')) {
                    exports.main.testMode = true;
                } else {
                    exports.main.testMode = false;
                }
                
                if (env['INSTANCE_NAME'] && !exports.main.instanceName) {
                    exports.main.instanceName = env['INSTANCE_NAME'];
                }

                if (env['SERVICE_NAME'] && !exports.main.serviceName) {
                    exports.main.instanceName = env['SERVICE_NAME'];
                }

            }
        }
    }

    // Периодическое обновление конфигов (каждые 10 секунд)
    setTimeout(loadConfig, 10000);
    if (callback) callback(null, null);
}

var getFiles = function (dir, files_, iter=0){
    files_ = files_ || [];
    var files = fs.readdirSync(dir);
    for (var i in files){
        var name = dir + '/' + files[i];
        if (fs.statSync(name).isDirectory()){
            getFiles(name, files_, iter+1);
        } else {
            var subDir = null;
            if (iter > 0) subDir = path.basename(dir);

            var fileObj = {
                name: name,
                subDir: subDir
            }
            // files_.push(name);
            files_.push(fileObj);
        }
    }
    return files_;
};