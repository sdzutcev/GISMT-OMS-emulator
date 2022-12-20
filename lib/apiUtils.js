var moment = require('moment');
var moment = require('moment-timezone');

var conf = require('./std/conf.js');
var log = require('./std/log.js');
var errors = require('./std/errors.js');
var Error = errors.Error;

var appDB = require('./std/appDB.js');

var path = require('path');
var fs = require('fs');
const JSON5 = require('json5');

var restApi = require('./std/rest-api.js');
const { hasUncaughtExceptionCaptureCallback } = require('process');



var moduleFuncs = [
    { funcName: "getPing", func: getPing },
]

for (var mf = 0; mf < moduleFuncs.length; mf++) {
    restApi.apiFuncs[moduleFuncs[mf].funcName] = moduleFuncs[mf].func;
}


// **********************************************************************************************************************
// **********************************************************************************************************************
// **********************************************************************************************************************
// **********************************************************************************************************************
// **********************************************************************************************************************

async function getPing(urlParams, bodyParams, headerParams, callParams, refId, callback, reCode) {
    try {
        // var ret = {codesToEmit: 0, ordersNum: 0, codesPerOrder: 0}; //формирование JSON 

        const { v4: uuidv4 } = require('uuid');
        var OrderID = uuidv4();

        omsID = urlParams.omsID;
        clienttoken = headerParams.clienttoken;
        var omsId = urlParams['omsId'];
        // appDB.Count=appDB.Count+1;

        var Res = { omsId: omsId, clientToken: clienttoken };

        console.log("Orders count: " + appDB.OrderDB.length);
        console.log("******************************");
        console.log("Total counts: ");
        console.log("Emission: " + appDB.EmissionTotal);
        console.log("Utilisation: " + appDB.UtilisationTotal);


        callback(null, Res);


    } catch (err) {
        var e = new Error(err, 'Ошибка в функции API getPing', refRec);
        callback(e, {}, 500);
        return;
    }
};


