const express = require('express');
const enforce = require('express-sslify');
const hbs = require('express-handlebars');
const database = require('./database');

const debug = process.env.PORT === undefined;

var app = express();
if (!debug)
    app.use(enforce.HTTPS({ trustProtoHeader: true }));

app.engine('.html', hbs({
    extname: '.html',
    defaultView: 'default',
    defaultLayout: 'default'
}));
app.set('view engine', '.html');

var port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

app.use(express.static('static'));

app.get('/', (req, res) => {
    res.render('index');
});

app.use((req, res) => {
    return res.status(404).render('404');
});

app.use((req, res) => {
    return res.status(500).render('505');
});
