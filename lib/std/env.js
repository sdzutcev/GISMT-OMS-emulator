var envVars = {
    // Режим конфигурации: files, consul, postgres, mongo, env и т.д.
    // В текущей версии поддерживается только files
    'CONFIG_MODE': 'files',
    'CONFIG_FILES': './msdata/config',
    'DATA_FILES': './msdata/data',
    'TEMP_FILES': './msdata/temp',
    'LOG_FILES': './msdata/logs',
    'TEMPLATES_FILES': './msdata/templates',
    'STATIC_FILES': './msdata/static',
    'MODULES_FILES': './msdata/modules',
    'INSTANCE_NAME': null,
    'SERVICE_NAME': null,
    'TEST_MODE': false
}

exports.init = async function () {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("Инициализация переменных окружения...");

            if (process.env && typeof process.env === 'object') {
                for (var v in process.env) {
                    var varName = v.toUpperCase();
                    var varValue = process.env[v].toLowerCase();

                    if (envVars.hasOwnProperty(varName)) {
                        exports[varName] = varValue;
                        console.log("Используется переменная окружения " + varName + ": " + varValue);
                    }
                }
            }

            // Устанавливаем значения по умолчанию
            for (var v in envVars) {
                if (envVars[v] && !this.hasOwnProperty(v)) {
                    console.log("Переменная окружения " + v + " не найдена, используется значение по умолчанию: " + envVars[v]);
                    exports[v] = envVars[v];
                }
            }

            console.log("Инициализация переменных окружения успешно завершена");
            resolve();

        } catch (err) {
            console.log("Инициализация переменных окружения завершена с ошибкой", err);
            reject('E_ConfigurationError');
        }
    });
}
