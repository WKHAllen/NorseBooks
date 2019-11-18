const express = require('express');
const enforce = require('express-sslify');
const hbs = require('express-handlebars');
const session = require('express-session');
const bodyParser = require('body-parser');
const owasp = require('owasp-password-strength-test');
const database = require('./database');

var debug = true;

try {
    var processenv = require('./processenv');
} catch (ex) {
    debug = false;
}

var port = process.env.PORT || processenv.port;
var sessionSecret = process.env.SESSION_SECRET || processenv.SESSION_SECRET;

// Helper that removes whitespace from the ends of a string
function stripWhitespace(str) {
    return str.replace(/^\s+|\s+$/g, '');
}

// The app object
var app = express();

// Disable caching for authentication purposes
app.set('etag', false);
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

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
    saveUninitialized: false
}));

// Include static directory for css and js files
app.use(express.static('static'));

// Authorize/authenticate
var auth = (req, res, next) => {
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
            res.render('login', { error: 'Invalid login' });
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
            if (req.body.password === req.body.passwordConfirm) {
                var result = owasp.test(req.body.password);
                if (result.errors.length === 0) {
                    if (stripWhitespace(req.body.firstname) !== '' && stripWhitespace(req.body.lastname) !== '') {
                        database.register(req.body.email, req.body.password, req.body.firstname, req.body.lastname);
                        res.redirect('/login');
                        // TODO: send verification email
                    } else {
                        res.render('register', { error: 'Please enter a valid name' });
                    }
                } else {
                    res.render('register', { error: result.errors.join('\n') });
                }
            } else {
                res.render('register', { error: 'Passwords do not match' });
            }
        } else {
            res.render('register', { error: 'That email address has already been registered' });
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

module.exports = app;
