const { Worker } = require("worker_threads");
var path = require('path');
var fs = require('fs');

var env = require('./std/env.js');
var conf = require('./std/conf.js');
var log = require('./std/log.js');
var errors = require('./std/errors.js');
var appDB = require('./std/appDB.js');

var fs = require('fs');

var Error = errors.Error;



exports.init = async function () {
    return new Promise(async (resolve, reject) => {
        try {

            await StartGeneratorSync();

            resolve();

        } catch (err) {
            console.log("Инициализация генератора заказов на эмиссию завершена с ошибкой", err);
            reject('E_ConfigurationError');
        }
    });
}

StartGeneratorSync = function () {
    return new Promise((resolve, reject) => {
        StartGenerator(function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

async function StartGenerator(callback) {

    try {
        appDB.OrderDB.forEach(element => {
            if (element.orderStatus == "PENDING" && element.inProgress == false) {
                const { v4: uuidv4 } = require('uuid');
                var workerID = uuidv4();

                var modulePath = path.join(__dirname, 'orderGeneratorWorker.js');
                const worker = new Worker(modulePath);

                // const worker = new Worker("./lib/orderGeneratorWorker.js");
                
                element.inProgress = true;
                worker.postMessage(element);

                worker.on('message', msg => {

                    element = appDB.OrderDB.find(
                        element =>
                            element.gtin == msg.gtin &&
                            element.orderId == msg.orderId &&
                            element.omsId == msg.omsId);
                    msg.orderStatus = "READY";
                    appDB.OrderDB.splice(appDB.OrderDB.indexOf(element), 1, msg)
                });
            }
        });



    } catch (err) {
        setTimeout(StartGenerator, 10000);
        console.log("Ошибка при запуске генератора кодов: " + err);
        if (callback) callback(null, null);
        return;
    }

    // Периодическое обновление заказов
    setTimeout(StartGenerator, 3000);
    if (callback) callback(null, null);
}


