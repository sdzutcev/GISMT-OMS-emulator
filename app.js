var env = require('./lib/std/env.js');
var conf = require('./lib/std/conf.js');
var log = require('./lib/std/log.js');
var errors = require('./lib/std/errors.js');
var restApi = require('./lib/std/rest-api.js');

var appDB = require('./lib/std/appDB.js');
var orderGenerator = require('./lib/orderGenerator.js');

var apiEmissionTobacco = require('./lib/apiEmission.js');
var apiUtils = require('./lib/apiUtils.js');
var apiReports = require('./lib/apiReports.js');

var Error = errors.Error;

process.on('uncaughtException', uncaughtHandler);
process.on('SIGINT', cleanup);
process.on('SIGUSR1', cleanup);
process.on('SIGUSR2', cleanup);


// Инициализация подсистем
(async () => {
    try {
        await env.init();
        await conf.init();
        await log.init();
        await errors.init();
        await restApi.init();
        await appDB.init();

        onInitComplete();

    } catch (err) {
        console.error("Ошибка при инициализации сервиса",err);
        cleanup();
    }
})();



async function onInitComplete() {

    await orderGenerator.init();
    
}

function uncaughtHandler(err) {

}

async function cleanup() {
    setTimeout(function () {
        process.exit(1);
    }, 2000);
};