exports.OrderDB = [];
exports.UtilisationDB = [];
exports.AgregationDB = [];
exports.EmissionTotal = 0;
exports.UtilisationTotal = 0;
exports.AggregationTotal = 0;

exports.init = async function () {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("Инициализация Application BD...");
            // console.log("Инициализация конфигурации успешно завершена");
            resolve();

        } catch (err) {
            console.log("Инициализация конфигурации завершена с ошибкой", err);
            // reject('E_ConfigurationError');
        }
    });
}


// var Order = class {

//     constructor(orderId, gtin, mrp, quantity, serialNumbers, serialNumberType, 
//         templateId, Pool = [], ResponseBody = {}, Ready = false) {
//         this.orderId = orderId;
//         this.gtin = gtin;
//         this.mrp = mrp;
//         this.quantity = quantity;
//         this.serialNumbers = serialNumbers;
//         this.serialNumberType = serialNumberType;
//         this.templateId = templateId;
//         this.serialNumberType = serialNumberType;
//         this.Pool = Pool;
//         this.Ready = Ready;
//         this.ResponseBody = ResponseBody;
//         this.inProgress = inProgress;

//         return this;
//     }


//     init(orderId) {
//         return new Promise(async (resolve, reject) => {
//             try {
//                 this.orderId = orderId;
//                 this.orderId = false;
//                 resolve(this);
//             } catch (err) {
//                 var e = new Error(err, "Ошибка инициализации БД " + this.dbCode, refId);
//                 reject(e);
//             }
//         });
//     }


// }

// var Utilisation = class {

//     constructor(sntins, usageType, productionLineId, productionOrderId, productionDate, brandcode, 
//         sourceReportId,reportStatus,Group,,, Ready = false) {
//         this.sntins = sntins;
//         this.usageType = usageType;
//         this.productionLineId = productionLineId;
//         this.productionOrderId = productionOrderId;
//         this.productionDate = productionDate;
//         this.brandcode = brandcode;
//         this.sourceReportId = sourceReportId;
//         this.Ready = Ready;
//         this.reportStatus = reportStatus;
//         this.Group = Group;
//         this.sntins = sntins;
//          return this;
//     }


//     init(orderId) {
//         return new Promise(async (resolve, reject) => {
//             try {
//                 this.orderId = orderId;
//                 this.orderId = false;
//                 resolve(this);
//             } catch (err) {
//                 var e = new Error(err, "Ошибка инициализации БД " + this.dbCode, refId);
//                 reject(e);
//             }
//         });
//     }


// }


// exports.Order = Order;