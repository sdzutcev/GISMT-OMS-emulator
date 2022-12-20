
var errors = require('./std/errors.js');
var Error = errors.Error;
var appDB = require('./std/appDB.js');
var restApi = require('./std/rest-api.js');


// **********************************************************************************************************************
// **********************************************************************************************************************
// **********************************************************************************************************************

var moduleFuncs = [
    { funcName: "utilisation", func: utilisation },
    { funcName: "aggregation", func: aggregation },
    { funcName: "reportinfo", func: reportinfo },
]

for (var mf = 0; mf < moduleFuncs.length; mf++) {
    restApi.apiFuncs[moduleFuncs[mf].funcName] = moduleFuncs[mf].func;
}

// **********************************************************************************************************************
// **********************************************************************************************************************
// **********************************************************************************************************************

async function utilisation(urlParams, bodyParams, headerParams, callParams, refId, callback) {
    try {

        const { v4: uuidv4 } = require('uuid');
        var reportId = uuidv4();

        var omsId = callParams.req.query.omsId;

        var Report = callParams.req["body"];
        Report["omsId"] = omsId;
        Report["reportId"] = reportId;
        Report["orderStatus"] = "PENDING";   
        Report["Group"] = 'Tobacco';
        Report["inProgress"] = false;
        
        appDB.UtilisationTotal = appDB.UtilisationTotal + Report.sntins.length;

       var Res = {
            omsId: omsId,
            reportId: reportId
        };

        console.log("Utilisation report received:" + reportId);

        callback(null, Res);

    } catch (err) {
        var e = new Error(err, 'Ошибка в функции API utilisation', refRec);
        callback(e, {}, 500);
        return;
    }
};

async function aggregation(urlParams, bodyParams, headerParams, callParams, refId, callback) {

    try {

        const { v4: uuidv4 } = require('uuid');
        var reportId = uuidv4();

        var omsId = callParams.req.query.omsId;

        var Order = callParams.req["body"];
        Order["omsId"] = omsId;
        Order["reportId"] = reportId;
        Order["Group"] = 'Tobacco';
        Order["inProgress"] = false;

        appDB.AggregationTotal = appDB.AggregationTotal + Order.aggregationUnits.length;

        var Res = {
            omsId: omsId,
            reportId: reportId
        };

        console.log("Aggregation report received:" + reportId);

        callback(null, Res);

    } catch (err) {
        var e = new Error(err, 'Ошибка в функции API aggregation', refRec);
        callback(e, {}, 500);
        return;
    }
};

async function reportinfo(urlParams, bodyParams, headerParams, callParams, refId, callback) {

    try {

        const { v4: uuidv4 } = require('uuid');
        var reportId = uuidv4();

        var omsId = callParams.req.query.omsId;

        var Order = callParams.req["body"];
        Order["omsId"] = omsId;
        Order["reportId"] = reportId;
        Order["Group"] = 'Tobacco';
        Order["inProgress"] = false;

        Randomaiser = Math.floor(Math.random() * (5 - 1 + 1)) + 1;

        var reportStatus = "SENT";

        if (Randomaiser !== 1){
            reportStatus = "SENT";
        }else
        {
            reportStatus = "PENDING";
        };


        var Res = {
            omsId: omsId,
            reportId: reportId,
            reportStatus: reportStatus
        };

        callback(null, Res);

    } catch (err) {
        var e = new Error(err, 'Ошибка в функции API reportinfo', refRec);
        callback(e, {}, 500);
        return;
    }
};