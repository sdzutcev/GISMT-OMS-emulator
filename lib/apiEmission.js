const moment = require('moment');
var errors = require('./std/errors.js');
var Error = errors.Error;
var appDB = require('./std/appDB.js');
var restApi = require('./std/rest-api.js');


// **********************************************************************************************************************
// **********************************************************************************************************************
// **********************************************************************************************************************

var moduleFuncs = [
    { funcName: "postEmissionOrder", func: postEmissionOrder },
    { funcName: "OrderStatus", func: OrderStatus },
    { funcName: "GetCodes", func: GetCodes },
    { funcName: "GetOrders", func: GetOrders },
    { funcName: "OrderClose", func: OrderClose },

]

for (var mf = 0; mf < moduleFuncs.length; mf++) {
    restApi.apiFuncs[moduleFuncs[mf].funcName] = moduleFuncs[mf].func;
}

// **********************************************************************************************************************
// **********************************************************************************************************************
// **********************************************************************************************************************

async function postEmissionOrder(urlParams, bodyParams, headerParams, callParams, refId, callback) {
    try {

        const { v4: uuidv4 } = require('uuid');
        var orderId = uuidv4();

        var group = callParams.req.params[0];

        var Order = callParams.req["body"];
        Order["omsId"] = callParams.req.query.omsId;
        Order["orderId"] = orderId;
        Order["orderStatus"] = "PENDING";   // PENDING - Создан-Обрабатывается, READY - Готов.
        Order["Group"] = group;
        Order["Pool"] = [];
        Order["ResponseBody"] = {};
        Order["inProgress"] = false;

        var OrderProducts = Order["products"][0];

        var appDBOrder = {};
        Object.assign(appDBOrder, OrderProducts, Order);

        appDB.OrderDB.push(appDBOrder);

        var omsId = urlParams['omsId'];

        var Res = {
            omsId: omsId,
            orderId: orderId,
            expectedCompleteTimestamp: 5000
        };

        console.log("Order created:" + orderId);

        callback(null, Res);

    } catch (err) {
        var e = new Error(err, 'Ошибка в функции API postEmissionOrder', refRec);
        callback(e, {}, 500);
        return;
    }
};

async function OrderStatus(urlParams, bodyParams, headerParams, callParams, refId, callback) {

    try {

        var urlParams = callParams.req.query;

        var gtin = urlParams.gtin;
        var orderId = urlParams.orderId;
        var omsId = urlParams.omsId;



        element = appDB.OrderDB.find(
            element =>
                element.gtin == gtin &&
                element.orderId == orderId &&
                element.omsId == omsId);

        if (typeof element == 'undefined') {
            callback(null, { "OrderStatus": 91 }, 401);
            return;
        }
        else if (element.orderStatus == "PENDING") {
            var orderBuferStatus = "PENDING";
            var leftInBuffer = -1;
            var totalCodes = -1;
            var availableCodes = -1;
            var unavailableCodes = -1;
            var totalPassed = -1
        }
        else {
            var poolInfo = [];
            poolInfo.push({
                status: "READY",
                quantity: element.Pool.length,
                leftInRegistrar: element.Pool.length,
                registrarId: "Virtual Registrar",
                isRegistrarReady: true,
                registrarErrorCount: 0,
                lastRegistrarErrorTimestamp: 0
            });
            var orderBuferStatus = "ACTIVE";
            var leftInBuffer = 0;
            var totalCodes = element.Pool.length;
            var availableCodes = element.Pool.length;
            var unavailableCodes = 0;
            var totalPassed = 0
        };

        var Res = {
            poolInfos: poolInfo,
            leftInBuffer: leftInBuffer,
            totalCodes: totalCodes,
            poolsExhausted: false,
            unavailableCodes: unavailableCodes,
            availableCodes: availableCodes,
            orderId: urlParams.orderId,
            gtin: urlParams.gtin,
            bufferStatus: orderBuferStatus,
            totalPassed: totalPassed,
            expiredDate: "1596792681987",
            omsId: urlParams.omsId
        };

        callback(null, Res);

    } catch (err) {
        var e = new Error(err, 'Ошибка в функции API OrderStatus', refRec);
        callback(e, {}, 500);
        return;
    }
};

async function GetOrders(urlParams, bodyParams, headerParams, callParams, refId, callback) {

    try {

        var urlParams = callParams.req.query;

        var omsId = urlParams.omsId;

        elements = appDB.OrderDB.filter(
            element => element.omsId == omsId);

        var OrderInfosArray = [];

        elements.forEach(element => {

            if (element.orderStatus == "READY") {
                var orderStatus = element.orderStatus;
                var leftInBuffer = 0;
                var totalCodes = element.Pool.length;
                var availableCodes = element.Pool.length;
                var unavailableCodes = 0;
                var totalPassed = 0;
                var orderId = element.orderId;
                var gtin = element.gtin;


            } else {
                var orderStatus = element.orderStatus;
                var leftInBuffer = -1;
                var totalCodes = -1;
                var availableCodes = -1;
                var unavailableCodes = -1;
                var totalPassed = -1
                var orderId = element.orderId;
                var gtin = element.gtin;

            }

            var poolInfo = [];
            poolInfo.push({
                status: "READY",
                quantity: element.Pool.length,
                leftInRegistrar: element.Pool.length,
                registrarId: "Virtual Registrar",
                isRegistrarReady: true,
                registrarErrorCount: 0,
                lastRegistrarErrorTimestamp: 0
            });

            var orderbuffers = {
                poolInfo: poolInfo,
                leftInBuffer: leftInBuffer,
                totalCodes: totalCodes,
                unavailableCodes: 0,
                orderId: orderId,
                gtin: gtin,
                bufferStatus: "READY",
                omsId: omsId
            };

            var buffers = [];
            buffers.push(orderbuffers);

            var orderInfos = {
                orderId: orderId,
                orderStatus: orderStatus,
                createdTimestamp: moment(),
                // createdTimestamp: 1550650989568,
                buffers: buffers
            };

            OrderInfosArray.push(orderInfos);


        });

        var Res = {
            omsId: omsId,
            orderInfos: OrderInfosArray
        };


        callback(null, Res);

    } catch (err) {
        var e = new Error(err, 'Ошибка в функции API OrderStatus', refRec);
        callback(e, {}, 500);
        return;
    }
};

async function GetCodes(urlParams, bodyParams, headerParams, callParams, refId, callback) {

    try {

        var urlParams = callParams.req.query;

        var gtin = urlParams.gtin;
        var orderId = urlParams.orderId;
        var omsId = urlParams.omsId;
        var quantity = urlParams.quantity;
        var lastBlockId = urlParams.lastBlockId;

        element = appDB.OrderDB.find(
            element =>
                element.gtin == gtin &&
                element.orderId == orderId &&
                element.omsId == omsId);

        if (typeof element == 'undefined') {
            callback(null, { "OrderStatus": 252 }, 401);
            return;
        }

        if (element.orderStatus !== "READY") {
            callback(null, {}, 200);
            return;
        }
        else {
            var ResponseBody = {
                omsId: element.omsId,
                codes: element.Pool,
                blockId: ""
            };
            Res = ResponseBody;
            element.orderStatus = "CLOSED";
        };

        appDB.EmissionTotal = appDB.EmissionTotal + element.quantity;

        console.log("Orders codes supplied: " + orderId);

        callback(null, Res);

    } catch (err) {
        var e = new Error(err, 'Ошибка в функции API OrderStatus', refRec);
        callback(e, {}, 500);
        return;
    }
};

async function OrderClose(urlParams, bodyParams, headerParams, callParams, refId, callback) {

    try {

        var urlParams = callParams.req.query;

        var gtin = urlParams.gtin;
        var orderId = urlParams.orderId;
        var omsId = urlParams.omsId;



        element = appDB.OrderDB.find(
            element =>
                // element.gtin == gtin &&
                element.orderId == orderId &&
                element.omsId == omsId);

        if (typeof element == 'undefined') {
            callback(null, { "OrderClose": 301 }, 401);
            return;
        }
        //Здесь проблема, возможно на стороне ТМ
        appDB.OrderDB.splice(appDB.OrderDB.indexOf(element), 1);



        var Res = {
            omsId: urlParams.omsId
        };

        callback(null, Res);

    } catch (err) {
        var e = new Error(err, 'Ошибка в функции API OrderClose', refRec);
        callback(e, {}, 500);
        return;
    }
};