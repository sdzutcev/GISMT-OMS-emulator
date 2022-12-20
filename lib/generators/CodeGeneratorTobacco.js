exports.generate = function (OrderData) {

    if (OrderData['templateId'] == 4 || OrderData['templateId'] == 16) {
        OrderData = GeneratePackCodes(OrderData)
        console.log("Codes generated: " + OrderData.orderId);
    }

    if (OrderData['templateId'] == 3) {
        OrderData = GenerateBundleCodes(OrderData)
        console.log("Codes generated: " + OrderData.orderId);
    }


    return OrderData;
};


GeneratePackCodes = function (OrderData) {
    const simbolArray = [];

    simbolArray.push(
        "A", "B", "C", "D", "E", "F", "G",
        "H", "I", "J", "K", "L", "M", "N",
        "O", "P", "Q", "R", "S", "T", "U",
        "V", "W", "X", "Y", "Z", "a", "b",
        "c", "d", "e", "f", "g", "h", "i",
        "j", "k", "l", "m", "n", "o", "p",
        "q", "r", "s", "t", "u", "v", "w",
        "x", "y", "z", "0", "1", "2", "3",
        "4", "5", "6", "7", "8", "9", "!",
        "d", "f", "&", "&", "*", "+", "-",
        "3", "f", "3", "e", ":", ";", "=",
        "<", ">", "?");

    var simbolA = simbolArray[0];


    //MRP Generator**************************************************************************
    mrp = OrderData.mrp;

    var remdiv = mrp;

    var mrpString = "";

    while (remdiv !== 0) {
        var quo = Math.floor(remdiv / 80);
        var rem = remdiv % 80;
        remdiv = quo;

        let nextSimbol = simbolArray[rem];
        mrpString = mrpString + nextSimbol;
    }
    mrpString = mrpString.padStart(4, simbolA);

    //MRP Generator**************************************************************************


    for (let count = 1; count <= OrderData.quantity; count++) {


        //Serial Generator**************************************************************************
        SerialCodeDex = Math.floor(Math.random() * (18899999999000 - 1 + 1)) + 1;

        var remdiv = SerialCodeDex;

        var SerialCodeString = "";

        while (remdiv !== 0) {
            var quo = Math.floor(remdiv / 80);
            var rem = remdiv % 80;
            remdiv = quo;

            let nextSimbol = simbolArray[rem];
            SerialCodeString = SerialCodeString + nextSimbol;
        }

        SerialCodeString = SerialCodeString.padStart(7, simbolA);

        //Serial Generator**************************************************************************

        //Cripto Generator**************************************************************************
        CriptoDex = Math.floor(Math.random() * (40123123 - 3123123 + 1)) + 3123123;

        var remdiv = CriptoDex;

        var CriptoString = "";

        while (remdiv !== 0) {
            var quo = Math.floor(remdiv / 80);
            var rem = remdiv % 80;
            remdiv = quo;

            let nextSimbol = simbolArray[rem];
            CriptoString = CriptoString + nextSimbol;
        }
        CriptoString = CriptoString.padStart(4, simbolA);

        //Cripto Generator**************************************************************************

        serialCode = OrderData.gtin + SerialCodeString + mrpString + CriptoString;
        OrderData.Pool.push(serialCode);
    }

    return OrderData;
}


GenerateBundleCodes = function (OrderData) {
    const simbolArray = [];
    simbolArray.push(
        "A", "B", "C", "D", "E", "F", "G",
        "H", "I", "J", "K", "L", "M", "N",
        "O", "P", "Q", "R", "S", "T", "U",
        "V", "W", "X", "Y", "Z", "a", "b",
        "c", "d", "e", "f", "g", "h", "i",
        "j", "k", "l", "m", "n", "o", "p",
        "q", "r", "s", "t", "u", "v", "w",
        "x", "y", "z", "0", "1", "2", "3",
        "4", "5", "6", "7", "8", "9", "!",
        "d", "f", "&", "&", "*", "+", "-",
        "3", "f", "3", "e", ":", ";", "=",
        "<", ">", "?");

    var simbolA = simbolArray[0];

    //MRP Generator**************************************************************************

    mrp = OrderData.mrp;

    var remdiv = mrp;

    var mrpString = "";

    while (remdiv !== 0) {
        var quo = Math.floor(remdiv / 80);
        var rem = remdiv % 80;
        remdiv = quo;

        let nextSimbol = simbolArray[rem];
        mrpString = mrpString + nextSimbol;
    }

    mrpString = mrpString.padStart(6, simbolA);

    //MRP Generator**************************************************************************


    for (let count = 1; count <= OrderData.quantity; count++) {


        //Serial Generator**************************************************************************
        SerialCodeDex = Math.floor(Math.random() * (18899999999999 - 8899999999999 + 1)) + 8899999999999;

        var remdiv = SerialCodeDex;

        var SerialCodeString = "";

        while (remdiv !== 0) {
            var quo = Math.floor(remdiv / 80);
            var rem = remdiv % 80;
            remdiv = quo;

            let nextSimbol = simbolArray[rem];
            SerialCodeString = SerialCodeString + nextSimbol;
        }
        SerialCodeString = SerialCodeString.padStart(4, simbolA);

        //Serial Generator**************************************************************************

        //Cripto Generator**************************************************************************
        CriptoDex = Math.floor(Math.random() * (40123123 - 3123123 + 1)) + 3123123;

        var remdiv = CriptoDex;

        var CriptoString = "";

        while (remdiv !== 0) {
            var quo = Math.floor(remdiv / 80);
            var rem = remdiv % 80;
            remdiv = quo;

            let nextSimbol = simbolArray[rem];
            CriptoString = CriptoString + nextSimbol;
        }

        CriptoString = CriptoString.padStart(4, simbolA);

        //Cripto Generator**************************************************************************

        serialCode =
            "01" + OrderData.gtin +
            "21" + SerialCodeString +
            String.fromCharCode(33) + "8005" + mrpString +
            String.fromCharCode(33) + "93" + CriptoString;

        OrderData.Pool.push(serialCode);
    }

    return OrderData;
}