const express = require('express');
const enforce = require('express-sslify');
const http = require('http');
const path = require('path');

var app = express();
app.use(enforce.HTTPS({ trustProtoHeader: true }));
var server = http.Server(app);
var port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

var publicDir = 'public';

app.use(express.static(path.join(__dirname, publicDir)));
