const express = require('express');
const enforce = require('express-sslify');
const hbs = require('express-handlebars');
const session = require('express-session');
const bodyParser = require('body-parser');
const owasp = require('owasp-password-strength-test');
const database = require('./database');
const emailer = require('./emailer');

var debug = true;

try {
    var processenv = require('./processenv');
} catch (ex) {
    debug = false;
}

var port = process.env.PORT || processenv.PORT;
var sessionSecret = process.env.SESSION_SECRET || processenv.SESSION_SECRET;

const hostname = 'https://www.norsebooks.com';

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

// Removes whitespace from the ends of a string
function stripWhitespace(str) {
    return str.replace(/^\s+|\s+$/g, '');
}

// Sends a registration verification email
function sendEmailVerification(email) {
    email = email.toLowerCase();
    database.newVerifyId(email, (verifyId) => {
        emailer.sendEmail(email, 'Norse Books - Verify Email',
            `Hello,\n\nWelcome to Norse Books! All we need is for you to confirm your email address. You can do this by clicking the link below.\n\n${hostname}/verify/${verifyId}\n\nIf you did not register for Norse Books, or you have already verified your email, please disregard this email.\n\nSincerely,\nThe Norse Books Dev Team`
        );
    });
}

// Authorize/authenticate
var auth = (req, res, next) => {
    if (!req.session) {
        return res.status(401).render('401', { title: 'Permission denied' });
    } else {
        database.auth(req.session.sessionId, (valid) => {
            if (valid)
                next();
            else
                return res.status(401).render('401', { title: 'Permission denied' });
        });
    }
}

// Main page
app.get('/', (req, res) => {
    res.render('index');
});

// Login page
app.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
});

// Login event
app.post('/login', (req, res) => {
    database.validLogin(req.body.email, req.body.password, (valid, sessionId) => {
        if (valid) {
            req.session.sessionId = sessionId;
            res.redirect('/');
        } else {
            res.render('login', { title: 'Login', error: 'Invalid login' });
        }
    });
});

// Registration page
app.get('/register', (req, res) => {
    res.render('register', { title: 'Register' });
});

// Registration event
app.post('/register', (req, res) => {
    var email = stripWhitespace(req.body.email);
    var fname = stripWhitespace(req.body.firstname);
    var lname = stripWhitespace(req.body.lastname);
    database.userExists(email, (exists) => {
        if (!exists) {
            if (email.length <= 64) {
                if (req.body.password === req.body.passwordConfirm) {
                    var result = owasp.test(req.body.password);
                    if (result.errors.length === 0) {
                        if (fname.length > 0 && fname.length <= 64 && lname.length > 0 && lname.length <= 64) {
                            database.register(email, req.body.password, fname, lname);
                            res.redirect('/login');
                            sendEmailVerification(email);
                        } else {
                            res.render('register', { title: 'Register', error: 'Please enter a valid name' });
                        }
                    } else {
                        res.render('register', { title: 'Register', error: result.errors.join('\n') });
                    }
                } else {
                    res.render('register', { title: 'Register', error: 'Passwords do not match' });
                }
            } else {
                res.render('register', { title: 'Register', error: 'Email address is too long' });
            }
        } else {
            res.render('register', { title: 'Register', error: 'That email address has already been registered' });
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

app.get('/verify/:verifyId', (req, res) => {
    database.checkVerifyID(req.params.verifyId, (valid) => {
        res.render('verify', { valid: valid });
        if (valid) {
            database.setValid(req.params.verifyId);
            database.deleteVerifyID(req.params.verifyId);
        }
    });
});

// TODO: remove this
// Test for the auth function
app.get('/test', auth, (req, res) => {
    res.send('Successfully authorized and authenticated');
});

// Error 404 (not found)
app.use((req, res) => {
    return res.status(404).render('404', { title: 'Not found' });
});

// Error 500 (internal server error)
app.use((req, res) => {
    return res.status(500).render('500', { title: 'Internal Server Error' });
});

// Listen for connections
app.listen(port, () => {
    console.log(`App running on port ${port}`);
});

module.exports = app;
