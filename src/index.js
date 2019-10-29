const express = require('express');
const enforce = require('express-sslify');
const hbs = require('express-handlebars');
const session = require('express-session');
const pgSession = require('connect-pg-simple');
const bodyParser = require('body-parser');
const database = require('./database');

const debug = process.env.PORT === undefined;
var port = process.env.PORT || 3000;
var sessionSecret = process.env.SESSION_SECRET;

// The app object
var app = express();

// Disable etag to fix caching problem
app.set('etag', false);

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

// Request body parsing
app.use(bodyParser.urlencoded({ extended: true }));

// Track sessions
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new pgSession({
        pool: database.mainDB.pool,
        tableName: 'Session'
    })
}));

// Include static directory for css and js files
app.use(express.static('static'));

// Authorize/authenticate
var auth = (req, res, next) => {
    console.log(req.session);
    if (!req.session) {
        return res.sendStatus(401);
    } else {
        database.auth(req.session.sessionId, (valid) => {
            if (valid)
                next();
            else
                return res.sendStatus(401);
        });
    }
}

// Main page
app.get('/', (req, res) => {
    res.render('index');
});

// Login page
app.get('/login', (req, res) => {
    res.render('login');
});

// Login event
app.post('/login', (req, res) => {
    database.validLogin(req.body.email, req.body.password, (valid, sessionId) => {
        if (valid) {
            req.session.sessionId = sessionId;
            res.redirect('/');
        } else {
            // return the page, with some error
            throw `Invalid login: ${req.body.email}, ${req.body.password}`;
        }
    });
});

// Registration page
app.get('/register', (req, res) => {
    res.render('register');
});

// Registration event
app.post('/register', (req, res) => {
    database.userExists(req.body.email, (exists) => {
        if (!exists) {
            // validate email, phone, password, firstname, lastname
            database.register(req.body.email, req.body.phone, req.body.password, req.body.firstname, req.body.lastname);
            res.redirect('/login');
            // require email verification
        } else {
            // return the page, with some error
            throw `User already exists: ${req.body.email}`;
        }
    });
});

// Logout event
app.get('/logout', (req, res) => {
    database.deleteSession(req.session.sessionId, () => {
        req.session.destroy();
        res.redirect('/login');
    });
});

// Test for the auth function
app.get('/test', auth, (req, res) => {
    res.send('Successfully authorized and authenticated');
});

// Error 404 (not found)
app.use((req, res) => {
    return res.status(404).render('404');
});

// Error 500 (internal server error)
app.use((req, res) => {
    return res.status(500).render('505');
});

// Listen for connections
app.listen(port, () => {
    console.log(`App running on port ${port}`);
});
