const http = require('http');
const fs = require('fs');
const url = require('url');
const path = require('path');
const formidable = require("formidable");
const util = require('util');

const ContentFolder = "content";

function extractContentType(filePath) {
    const fileExt = path.extname(filePath);
    switch (fileExt) {
        case '.js':
            return 'text/javascript';
        case '.html':
            return 'text/html';
        case '.txt':
            return 'text/plain';
        case '.css':
            return 'text/css';
        case '.json':
            return 'application/json';
        case '.png':
            return 'image/png';
        case '.jpg':
            return 'image/jpg';
        case '.wav':
            return 'audio/wav';
    }
}

function readAndServeFile(filePath, contentType, response) {

    fs.readFile(filePath, function (error, content) {
        if (error) {
            response.writeHead(500);
            response.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            response.end();
        }
        else {
            response.writeHead(200, {'Content-Type': contentType});
            response.end(content, 'utf-8');
        }
    });
}

function addItemUI(request, response) {
    switch (request.method.toLowerCase()) {
        case 'get':
            serveFile("./pages/add-item.html", response);
            break;
        case "post":
            processAllFieldsOfTheForm(request, response);
            break;
    }
}

function processAllFieldsOfTheForm(request, response) {
    const form = new formidable.IncomingForm();

    form.parse(request, function (err, fields, files) {
        fields.actions = decodeURI(fields.actions);
        addItemImpl(fields, response);
    });
}

function readBody(request) {
    let body = '';

    request.on('data', function (data) {
        body += data;

        // Too much POST data, kill the connection!
        // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
        if (body.length > 1e6)
            request.connection.destroy();
    });
    return body;
}

function addItemPost(request, response) {
    const body = readBody(request);
    if (body.length === 0) {
        const expectedBody = {};
        expectedBody.itemName = "item name here";
        expectedBody.groupName = "group name here";
        expectedBody.jsonBody = "json body here";

        response.writeHead(400);
        response.end(`Expected json body example:\n\n${JSON.stringify(expectedBody, null, 2)}`, 'utf-8');
        return;
    }
    request.on('end', function () {
        const post = JSON.parse(body);
        addItemImpl(post, response);
    });
}

function createFolderIfDoesntExists(post) {
    let folder = `./${ContentFolder}${post.groupName ? "/" + post.groupName : ""}`;
    if (!fs.existsSync(folder))
        mkdirs(folder);

    return folder;
}

function mkdirs(folder) {
    let fullPath = "./"
    folder.split('/').forEach(function (dir) {
        fullPath += dir + "/"
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath);
        }
    });
}

function addItemImpl(post, response) {
    let folder = createFolderIfDoesntExists(post);

    const outputFile = `${folder}/${post.itemName}.json`;
    console.log("outputFile: " + outputFile);

    fs.writeFileSync(outputFile, JSON.stringify(post.jsonBody, null, 2), 'utf8');
    response.writeHead(200, {
        'content-type': 'text/plain'
    });
    response.write('received the data.');
    response.end();
}

function serveFile(filePath, response) {
    if (!fs.existsSync(filePath)) {
        response.writeHead(404);
        response.end("NO SUCH ITEM: " + filePath, 'utf-8');
        return;
    }

    const contentType = extractContentType(filePath);
    console.log('Serving file: ' + filePath + '\n  ContentType: ' + contentType);
    readAndServeFile(filePath, contentType, response);
}

function listFiles(request, response) {
    const query = url.parse(request.url, true).query;
    const groupFolder = createFolderIfDoesntExists(query);

    const items = fs.readdirSync(groupFolder).filter(function (itemName) {
        return itemName.endsWith(".json") || !query.groupName;
    }).map(function (itemName) {
        return query.groupName ? itemName.substring(0, itemName.length - ".json".length) : itemName;
    });

    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify(items), 'utf-8');
}

const port = 2999;
http.createServer(function (request, response) {
    console.log('request starting...');

    if (request.url.startsWith("/add-item"))
        addItemUI(request, response);
    else if (request.url.startsWith("/add-api"))
        addItemPost(request, response);
    else if (request.url.startsWith("/list"))
        listFiles(request, response);
    else if (request.url.startsWith(`/get-item`)) {
        const query = url.parse(request.url, true).query;
        const filePath = `./${ContentFolder}/${query.groupName}/${query.itemName}.json`;

        serveFile(filePath, response);
    } else {
        response.writeHead(404);
        response.end("NO SUCH PAGE", 'utf-8');
    }

}).listen(port);

console.log('Listening on port: ' + port);


