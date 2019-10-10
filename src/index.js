const express = require('express');
const enforce = require('express-sslify');
const hbs = require('express-handlebars');
const database = require('./database');

const debug = process.env.PORT === undefined;
var port = process.env.PORT || 3000;

// The app object
var app = express();

// Enforce HTTPS
if (!debug)
    app.use(enforce.HTTPS({ trustProtoHeader: true }));

// Use view engine
app.engine('.html', hbs({
    extname: '.html',
    defaultView: 'default',
    defaultLayout: 'default'
}));
app.set('view engine', '.html');

// Listen for connections
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Include static directory for css and js files
app.use(express.static('static'));

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

// Error 404
app.use((req, res) => {
    return res.status(404).render('404');
});

// Error 500
app.use((req, res) => {
    return res.status(500).render('505');
});
