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

const maxNumBooks = 8;

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
    if (!str && str !== '') return '';
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

// Check if a book form is valid
function validBook(form, callback) {
    var title = stripWhitespace(form.title);
    var author = stripWhitespace(form.author);
    var department = parseInt(stripWhitespace(form.department));
    var courseNumber = parseInt(stripWhitespace(form.courseNumber));
    var price = Math.floor(parseFloat(stripWhitespace(form.price.replace('$', ''))) * 100) / 100;
    var condition = stripWhitespace(form.condition);
    var imageUrl = stripWhitespace(form.imageUrl);
    var description = stripWhitespace(form.description);
    // Check title
    if (title.length === 0 || title.length > 128) {
        callback(false, 'Please enter the title of the book. It must be at most 128 characters long.');
    } else {
        // Check author
        if (author.length === 0 || author.length > 64) {
            callback(false, 'Please enter the author\'s name. It must be at most 64 characters long.');
        } else {
            // Check department
            database.validDepartment(department, (valid) => {
                if (!valid) {
                    callback(false, 'Please select a valid department.');
                } else {
                    // Check course number
                    if (stripWhitespace(form.courseNumber).length > 0 && (isNaN(courseNumber) || courseNumber < 101 || courseNumber > 499)) {
                        callback(false, 'Please enter a valid course number.');
                    } else {
                        // Check price
                        if (isNaN(price) || price < 0 || price > 999.99) {
                            callback(false, 'Please enter a valid price less than $1000.');
                        } else {
                            // Check condition
                            database.validCondition(condition, (valid) => {
                                if (!valid) {
                                    callback(false, 'Please select a valid book condition.');
                                } else {
                                    // Check imageUrl
                                    if (imageUrl.length > 256) {
                                        callback(false, 'Please enter a valid image URL or leave the box blank. The URL must be less than 256 characters.');
                                    } else {
                                        // Check description
                                        if (description.length === 0 || description.length > 1024) {
                                            callback(false, 'Please enter a description of at most 1024 characters.');
                                        } else {
                                            callback(true, null, {
                                                title: title,
                                                author: author,
                                                department: department,
                                                courseNumber: courseNumber,
                                                price: price,
                                                condition: condition,
                                                imageUrl: imageUrl,
                                                description: description
                                            });
                                        }
                                    }
                                }
                            });
                        }
                    }
                }
            });
        }
    }
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

// Verify email address page
app.get('/verify/:verifyId', (req, res) => {
    database.checkVerifyID(req.params.verifyId, (valid) => {
        res.render('verify', { title: 'Verify', valid: valid });
        if (valid) {
            database.setVerified(req.params.verifyId);
            database.deleteVerifyID(req.params.verifyId);
        }
    });
});

// List new book page
app.get('/book', auth, (req, res) => {
    database.getAuthUser(req.session.sessionId, (userId) => {
        database.getNumBooks(userId, (numBooks) => {
            if (numBooks < maxNumBooks) {
                database.getDepartments((departments) => {
                    database.getConditions((conditions) => {
                        res.render('new-book', { title: 'New Book', departments: departments, conditions: conditions });
                    });
                });
            } else {
                res.render('max-books', { title: 'Too many books' });
            }
        });
    });
});

// List new book event
app.post('/book', auth, (req, res) => {
    validBook(req.body, (valid, err, values) => {
        if (valid) {
            database.getAuthUser(req.session.sessionId, (userId) => {
                database.newBook(values.title, values.author, values.department, values.courseNumber || null, values.condition, values.description, userId, values.price, values.imageUrl || null, (id, bookId) => {
                    res.redirect(`/book/${bookId}`);
                });
            });
        } else {
            database.getDepartments((departments) => {
                database.getConditions((conditions) => {
                    res.render('new-book', { title: 'New Book', departments: departments, conditions: conditions, error: err, form: {
                        title: req.body.title,
                        author: req.body.author,
                        department: req.body.department,
                        courseNumber: req.body.courseNumber,
                        price: req.body.price,
                        condition: req.body.condition,
                        imageUrl: req.body.imageUrl,
                        description: req.body.description
                    }});
                });
            });
        }
    });
});

app.get('/book/:bookId', (req, res) => {
    database.validBook(req.params.bookId, (valid) => {
        if (valid) {
            database.getBookInfo(req.params.bookId, (bookInfo) => {
                database.getDepartmentName(bookInfo.departmentid, (department) => {
                    database.getConditionName(bookInfo.conditionid, (condition) => {
                        res.render('book', {
                            title: bookInfo.title,
                            author: bookInfo.author,
                            department: department,
                            courseNumber: bookInfo.coursenumber,
                            price: bookInfo.price,
                            condition: condition,
                            imageUrl: bookInfo.imageurl, // TODO: add default imageUrl here
                            description: bookInfo.description
                        });
                    });
                });
            });
        } else {
            res.render('book-not-found', { title: 'Book not found' });
        }
    });
});

app.get('/about', (req, res) => {
    res.render('about', { title: 'About NorseBooks' });
});

app.get('/contact', (req, res) => {
    res.render('contact', { title: 'Contact Us' });
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
