var { parentPort } = require('worker_threads');
var path = require('path');
var fs = require('fs');

parentPort.on('message', OrderData => {

    try {

        var modulePath = path.join(__dirname, 'generators', 'CodeGeneratorTobacco.js');
        const CodeGenerator = require(modulePath);

        // const CodeGenerator = require("./generators/CodeGeneratorTobacco.js");

        OrderData = CodeGenerator.generate(OrderData);

        parentPort.postMessage(OrderData);

    } catch (error) {
        process.exit();
    }

    process.exit();
});



exports.init = {};
