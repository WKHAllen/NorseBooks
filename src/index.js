const express = require('express');
const enforce = require('express-sslify');
const hbs = require('express-handlebars');
const session = require('express-session');
const bodyParser = require('body-parser');
const owasp = require('owasp-password-strength-test');
const randomPassword = require('secure-random-password');
const multer = require('multer');
const cloudinary = require('cloudinary');
const remarkable = require('remarkable');
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
var cloudinaryName = process.env.CLOUDINARY_NAME || processenv.CLOUDINARY_NAME;
var cloudinaryApiKey = process.env.CLOUDINARY_API_KEY || processenv.CLOUDINARY_API_KEY;
var cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET || processenv.CLOUDINARY_API_SECRET;

const ISBNChars = '0123456789X';

var md = new remarkable.Remarkable();

var storage = multer.diskStorage({
    filename: function(req, file, callback) {
        callback(null, Date.now() + file.originalname);
    }
});

var upload = multer({ storage: storage });

cloudinary.config({
    cloud_name: cloudinaryName,
    api_key: cloudinaryApiKey,
    api_secret: cloudinaryApiSecret
});

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

// Get the hostname of a request
function getHostname(req) {
    return `${req.protocol}://${req.get('host')}`;
}

// Generate a random password
function newRandomPassword() {
    var examplePassword = randomPassword.randomPassword({ length: 10, characters: [
        randomPassword.lower, randomPassword.upper, randomPassword.digits, randomPassword.symbols
    ]});
    return examplePassword;
}

// Send a registration verification email
function sendEmailVerification(email, hostname) {
    email = email.toLowerCase();
    database.newVerifyId(email, (verifyId) => {
        emailer.sendEmail(email + '@luther.edu', 'Norse Books - Verify Email',
            `Hello,<br><br>Welcome to Norse Books! All we need is for you to confirm your email address. You can do this by clicking the link below.<br><br>${hostname}/verify/${verifyId}<br><br>If you did not register for Norse Books, or you have already verified your email, please disregard this email, and do not click on the above link.<br><br>Sincerely,<br>The Norse Books Dev Team`
        );
    });
}

// Send a password reset email
function sendPasswordResetEmail(email, hostname) {
    email = email.toLowerCase();
    database.newPasswordResetId(email, (passwordResetId) => {
        emailer.sendEmail(email + '@luther.edu', 'Norse Books - Password Reset',
            `Hello,<br><br>A password reset request was sent. To reset your password, please click on the link below.<br><br>${hostname}/password-reset/${passwordResetId}<br><br>If you did not request to reset your password, please disregard this email. Do not share the above link with anyone.<br><br>Sincerely,<br>The Norse Books Dev Team`
        );
    });
}

// Remove unnecessary characters from an ISBN
function minISBN(ISBN) {
    while (ISBN.includes('-')) ISBN = ISBN.replace('-', '');
    while (ISBN.includes(' ')) ISBN = ISBN.replace(' ', '');
    return ISBN;
}

// Check if an ISBN is valid
function validISBN(ISBN) {
    if (ISBN.length !== 10 && ISBN.length !== 13) return false;
    for (var char of ISBN)
        if (!ISBNChars.includes(char))
            return false;
    return true;
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
    var ISBN10 = minISBN(stripWhitespace(form.ISBN10).toUpperCase());
    var ISBN13 = minISBN(stripWhitespace(form.ISBN13).toUpperCase());
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
                                            // Check ISBN10
                                            if (ISBN10.length > 0 && !validISBN(ISBN10)) {
                                                callback(false, 'Please enter a valid ISBN-10.');
                                            } else {
                                                // Check ISBN13
                                                if (ISBN13.length > 0 && !validISBN(ISBN13)) {
                                                    callback(false, 'Please enter a valid ISBN-13.');
                                                } else {
                                                    callback(true, null, {
                                                        title: title,
                                                        author: author,
                                                        department: department,
                                                        courseNumber: courseNumber,
                                                        price: price,
                                                        condition: condition,
                                                        ISBN10: ISBN10,
                                                        ISBN13: ISBN13,
                                                        imageUrl: imageUrl,
                                                        description: description
                                                    });
                                                }
                                            }
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
    if (!req.session || !req.session.sessionId) {
        return res.status(401).render('401', { title: 'Permission denied', after: req.originalUrl });
    } else {
        database.auth(req.session.sessionId, (valid) => {
            if (valid) next();
            else return res.status(401).render('401', { title: 'Permission denied', after: req.originalUrl });
        });
    }
}

// Authenticate an admin
var adminAuth = (req, res, next) => {
    if (!req.session || !req.session.sessionId) {
        return res.status(401).render('401', { title: 'Permission denied', after: req.originalUrl });
    } else {
        database.auth(req.session.sessionId, (valid) => {
            if (valid) {
                database.getAuthUser(req.session.sessionId, (userId) => {
                    database.isAdmin(userId, (admin) => {
                        if (admin) next();
                        else return res.status(401).render('not-admin', { title: 'Permission denied', after: req.originalUrl });
                    });
                });
            } else {
                return res.status(401).render('401', { title: 'Permission denied', after: req.originalUrl });
            }
        });
    }
}

// Render a page
function renderPage(req, res, page, options) {
    options = options || {};
    database.getMeta('Version', (version) => {
        options.version = version;
        if (!req.session || !req.session.sessionId) {
            options.loggedIn = false;
            res.render(page, options);
        } else {
            database.getNavInfo(req.session.sessionId, (result) => {
                if (!result) {
                    options.loggedIn = false;
                    res.render(page, options);
                } else {
                    options.loggedIn = true;
                    options.userImageUrl = result.imageurl;
                    options.userFirstName = result.firstname;
                    options.admin = result.admin;
                    res.render(page, options);
                }
            });
        }
    });
}

// Main page
app.get('/', (req, res) => {
    database.getDepartments((departments) => {
        database.getSearchSortOptions((searchSortOptions) => {
            if (!req.query.title && !req.query.author && !req.query.department && !req.query.courseNumber && !req.query.ISBN && !req.query.sort) {
                renderPage(req, res, 'index', { departments: departments, sortOptions: searchSortOptions });
            } else {
                renderPage(req, res, 'index', { departments: departments, sortOptions: searchSortOptions, form: {
                    title: req.query.title,
                    author: req.query.author,
                    department: req.query.department,
                    courseNumber: req.query.courseNumber,
                    ISBN: req.query.ISBN,
                    sort: req.query.sort
                }});
            }
        });
    });
});

// Get more books to populate the index page
app.get('/getBooks', (req, res) => {
    database.validBook(req.query.lastBook, (exists) => {
        if (exists || !req.query.lastBook) {
            // title
            var title = stripWhitespace(req.query.title);
            // author
            var author = stripWhitespace(req.query.author);
            // department
            var department = parseInt(stripWhitespace(req.query.department));
            if (isNaN(department)) department = null;
            // course number
            var courseNumber = parseInt(stripWhitespace(req.query.courseNumber));
            // ISBN
            var ISBN = minISBN(stripWhitespace(req.query.ISBN).toUpperCase());
            // sort
            var sort = parseInt(stripWhitespace(req.query.sort));
            if (isNaN(sort)) sort = null;
            var searchOptions = {};
            // Check title
            if (title.length > 0 && title.length <= 128) searchOptions.title = title;
            // Check author
            if (author.length > 0 && author.length <= 64) searchOptions.author = author;
            // Check department
            database.validDepartment(department, (valid) => {
                if (valid) searchOptions.departmentId = department;
                // Check course number
                if (!isNaN(courseNumber) && courseNumber >= 101 && courseNumber <= 499) searchOptions.courseNumber = courseNumber;
                // Check ISBN
                if (validISBN(ISBN)) searchOptions.ISBN = ISBN;
                // Check sort
                database.validSearchSortOption(sort, (valid) => {
                    if (!valid) sort = null;
                    // Perform search
                    database.searchBooks(searchOptions, sort, req.query.lastBook, (rows) => {
                        res.json({ books: rows });
                    });
                });
            });
        } else {
            res.json({ err: 'Last book does not exist' });
        }
    });
});

// Login page
app.get('/login', (req, res) => {
    renderPage(req, res, 'login', { title: 'Login' });
});

// Login event
app.post('/login', (req, res) => {
    database.validLogin(req.body.email.replace('@luther.edu', ''), req.body.password, (valid, sessionId) => {
        if (valid) {
            req.session.sessionId = sessionId;
            if (req.query.after)
                res.redirect(req.query.after);
            else
                res.redirect('/');
        } else {
            renderPage(req, res, 'login', { title: 'Login', error: 'Invalid login' });
        }
    });
});

// Registration page
app.get('/register', (req, res) => {
    renderPage(req, res, 'register', { title: 'Register', passwordExample: newRandomPassword() });
});

// Registration event
app.post('/register', (req, res) => {
    var email = stripWhitespace(req.body.email).replace('@luther.edu', '');
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
                            res.redirect('/register-success');
                            sendEmailVerification(email, getHostname(req));
                        } else {
                            renderPage(req, res, 'register', { title: 'Register', error: 'Please enter a valid name', passwordExample: newRandomPassword() });
                        }
                    } else {
                        renderPage(req, res, 'register', { title: 'Register', error: result.errors.join('\n'), passwordExample: newRandomPassword() });
                    }
                } else {
                    renderPage(req, res, 'register', { title: 'Register', error: 'Passwords do not match', passwordExample: newRandomPassword() });
                }
            } else {
                renderPage(req, res, 'register', { title: 'Register', error: 'Email address is too long', passwordExample: newRandomPassword() });
            }
        } else {
            renderPage(req, res, 'register', { title: 'Register', error: 'That email address has already been registered', passwordExample: newRandomPassword() });
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

// After registering
app.get('/register-success', (req, res) => {
    renderPage(req, res, 'register-success', { title: 'Successfully registered' });
});

// Verify email address page
app.get('/verify/:verifyId', (req, res) => {
    database.checkVerifyId(req.params.verifyId, (valid) => {
        renderPage(req, res, 'verify', { title: 'Verify', valid: valid });
        if (valid) {
            database.setVerified(req.params.verifyId);
            database.deleteVerifyId(req.params.verifyId);
        }
    });
});

// Request password reset page
app.get('/password-reset', (req, res) => {
    renderPage(req, res, 'password-reset-request', { title: 'Password reset request' });
});

// Request password reset event
app.post('/password-reset', (req, res) => {
    var email = stripWhitespace(req.body.email).replace('@luther.edu', '');
    renderPage(req, res, 'password-reset-request-success', { title: 'Password reset request' });
    database.passwordResetExists(email, (exists) => {
        if (!exists) {
            sendPasswordResetEmail(email, getHostname(req));
        }
    });
});

// Password reset page
app.get('/password-reset/:passwordResetId', (req, res) => {
    database.checkPasswordResetId(req.params.passwordResetId, (valid) => {
        renderPage(req, res, 'password-reset', { title: 'Reset password', valid: valid, passwordExample: newRandomPassword() });
    });
});

// Password reset event
app.post('/password-reset/:passwordResetId', (req, res) => {
    if (req.body.newPassword === req.body.confirmNewPassword) {
        var result = owasp.test(req.body.newPassword);
        if (result.errors.length === 0) {
            database.resetPassword(req.params.passwordResetId, req.body.newPassword);
            renderPage(req, res, 'password-reset-success', { title: 'Password reset success' });
        } else {
            renderPage(req, res, 'password-reset', { title: 'Reset password', valid: true, passwordExample: newRandomPassword(), error: result.errors.join('\n') });
        }
    } else {
        renderPage(req, res, 'password-reset', { title: 'Reset password', valid: true, passwordExample: newRandomPassword(), error: 'Passwords do not match' });
    }
});

// List new book page
app.get('/book', auth, (req, res) => {
    database.getAuthUser(req.session.sessionId, (userId) => {
        database.getNumBooks(userId, (numBooks) => {
            database.getMeta('Max books', (maxNumBooks) => {
                maxNumBooks = parseInt(maxNumBooks);
                if (numBooks < maxNumBooks) {
                    database.hasContactInfo(userId, (hasInfo) => {
                        if (hasInfo) {
                            database.getDepartments((departments) => {
                                database.getConditions((conditions) => {
                                    renderPage(req, res, 'new-book', { title: 'New book', departments: departments, conditions: conditions });
                                });
                            });
                        } else {
                            renderPage(req, res, 'no-contact-info', { title: 'No contact info' });
                        }
                    });
                } else {
                    renderPage(req, res, 'max-books', { title: 'Too many books' });
                }
            });
        });
    });
});

// List new book event
app.post('/book', auth, upload.single('image'), (req, res) => {
    cloudinary.uploader.upload(req.file.path, function(result) {
        validBook(req.body, (valid, err, values) => {
            if (valid) {
                database.getAuthUser(req.session.sessionId, (userId) => {
                    database.newBook(values.title, values.author, values.department, values.courseNumber || null, values.condition, values.description, userId, values.price, result.secure_url || null, values.ISBN10 || null, values.ISBN13 || null, (bookId) => {
                        res.redirect(`/book/${bookId}`);
                    });
                });
            } else {
                database.getDepartments((departments) => {
                    database.getConditions((conditions) => {
                        renderPage(req, res, 'new-book', { title: 'New book', departments: departments, conditions: conditions, error: err, form: {
                            title: req.body.title,
                            author: req.body.author,
                            department: req.body.department,
                            courseNumber: req.body.courseNumber,
                            price: req.body.price,
                            condition: req.body.condition,
                            ISBN10: req.body.ISBN10,
                            ISBN13: req.body.ISBN13,
                            imageUrl: req.body.imageUrl,
                            description: req.body.description
                        }});
                    });
                });
            }
        });
    });
});

// View a book
app.get('/book/:bookId', (req, res) => {
    database.validBook(req.params.bookId, (valid) => {
        if (valid) {
            database.getBookInfo(req.params.bookId, (bookInfo) => {
                database.getUserBookInfo(req.params.bookId, (userBookInfo) => {
                    database.getDepartmentName(bookInfo.departmentid, (department) => {
                        database.getConditionName(bookInfo.conditionid, (condition) => {
                            database.getPlatformName(userBookInfo.contactplatformid, (platform) => {
                                database.getAuthUser(req.session.sessionId, (userId) => {
                                    database.userReportedBook(userId, bookInfo.id, (alreadyReported) => {
                                        database.userReportedRecently(userId, (reportedRecently) => {
                                            renderPage(req, res, 'book', {
                                                title: bookInfo.title,
                                                author: bookInfo.author,
                                                department: department,
                                                courseNumber: bookInfo.coursenumber,
                                                price: bookInfo.price,
                                                condition: condition,
                                                ISBN10: bookInfo.isbn10,
                                                ISBN13: bookInfo.isbn13,
                                                imageUrl: bookInfo.imageurl,
                                                description: bookInfo.description,
                                                firstname: userBookInfo.firstname,
                                                lastname: userBookInfo.lastname,
                                                contactPlatform: platform,
                                                contactInfo: userBookInfo.contactinfo,
                                                bookOwner: userId === userBookInfo.id,
                                                bookId: req.params.bookId,
                                                canReport: !alreadyReported && !reportedRecently
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        } else {
            renderPage(req, res, 'book-not-found', { title: 'Book not found' });
        }
    });
});

// Edit book page
app.get('/edit/:bookId', auth, (req, res) => {
    database.validBook(req.params.bookId, (valid) => {
        if (valid) {
            database.getAuthUser(req.session.sessionId, (userId) => {
                database.getUserBookInfo(req.params.bookId, (userBookInfo) => {
                    if (userId === userBookInfo.id) {
                        database.getBookInfo(req.params.bookId, (bookInfo) => {
                            database.getDepartments((departments) => {
                                database.getConditions((conditions) => {
                                    renderPage(req, res, 'edit', { title: 'Edit book', departments: departments, conditions: conditions, form: {
                                        bookId: req.params.bookId,
                                        title: bookInfo.title,
                                        author: bookInfo.author,
                                        department: bookInfo.departmentid,
                                        courseNumber: bookInfo.coursenumber,
                                        price: bookInfo.price,
                                        condition: bookInfo.conditionid,
                                        ISBN10: bookInfo.isbn10,
                                        ISBN13: bookInfo.isbn13,
                                        imageUrl: bookInfo.imageurl,
                                        description: bookInfo.description
                                    }});
                                });
                            });
                        });
                    } else {
                        renderPage(req, res, 'unable-to-edit', { title: 'Unable to edit book' });
                    }
                });
            });
        } else {
            renderPage(req, res, 'book-not-found', { title: 'Book not found' });
        }
    });
});

// Edit book event
app.post('/edit/:bookId', auth, upload.single('image'), (req, res) => {
    validBook(req.body, (valid, err, values) => {
        if (valid) {
            if (req.file) {
                cloudinary.uploader.upload(req.file.path, function(result) {
                    database.getAuthUser(req.session.sessionId, (userId) => {
                        database.editBook(req.params.bookId, values.title, values.author, values.department, values.courseNumber || null, values.condition, values.description, userId, values.price, result.secure_url || null, values.ISBN10 || null, values.ISBN13 || null, () => {
                            res.redirect(`/book/${req.params.bookId}`);
                        });
                    });
                });
            } else {
                database.getAuthUser(req.session.sessionId, (userId) => {
                    database.editBook(req.params.bookId, values.title, values.author, values.department, values.courseNumber || null, values.condition, values.description, userId, values.price, null, values.ISBN10 || null, values.ISBN13 || null, () => {
                        res.redirect(`/book/${req.params.bookId}`);
                    });
                });
            }
        } else {
            database.getDepartments((departments) => {
                database.getConditions((conditions) => {
                    renderPage(req, res, 'edit', { title: 'Edit book', departments: departments, conditions: conditions, error: err, form: {
                        bookId: req.params.bookId,
                        title: req.body.title,
                        author: req.body.author,
                        department: req.body.department,
                        courseNumber: req.body.courseNumber,
                        price: req.body.price,
                        condition: req.body.condition,
                        ISBN10: req.body.ISBN10,
                        ISBN13: req.body.ISBN13,
                        imageUrl: req.body.imageUrl,
                        description: req.body.description
                    }});
                });
            });
        }
    });
});

// Delete book event
app.post('/deleteBook/:bookId', auth, (req, res) => {
    database.getAuthUser(req.session.sessionId, (userId) => {
        database.getBookInfo(req.params.bookId, (bookInfo) => {
            database.deleteBook(userId, bookInfo.id, () => {
                res.redirect('/');
            });
        });
    });
});

// Report book event
app.post('/reportBook/:bookId', auth, (req, res) => {
    database.getAuthUser(req.session.sessionId, (userId) => {
        database.getBookInfo(req.params.bookId, (bookInfo) => {
            database.userReportedBook(userId, bookInfo.id, (alreadyReported) => {
                database.userReportedRecently(userId, (reportedRecently) => {
                    if (!alreadyReported && !reportedRecently) {
                        database.reportBook(userId, bookInfo.id, (deleted) => {
                            if (deleted) res.redirect('/');
                            else res.redirect(`/book/${req.params.bookId}`);
                        });
                    } else {
                        res.redirect(`/book/${req.params.bookId}`);
                    }
                });
            });
        });
    });
});

// Profile viewing/editing page
app.get('/profile', auth, (req, res) => {
    database.getAuthUser(req.session.sessionId, (userId) => {
        database.getUserInfo(userId, (userInfo) => {
            database.getContactInfo(userId, (userContactInfo) => {
                database.getPlatforms((platforms) => {
                    database.getUserBooks(userId, (booksListed) => {
                        var joinTimestamp = new Date(userInfo.jointimestamp * 1000).toDateString();
                        var contactPlatform = userContactInfo.contactplatformid;
                        if (contactPlatform === null) contactPlatform = '';
                        var contactInfo = userContactInfo.contactinfo;
                        if (contactInfo === null) contactInfo = '';
                        renderPage(req, res, 'profile', {
                            title: 'Your profile',
                            error: req.session.errorMsg || undefined,
                            firstname: userInfo.firstname,
                            lastname: userInfo.lastname,
                            email: userInfo.email + '@luther.edu',
                            imageUrl: userInfo.imageurl,
                            joined: joinTimestamp,
                            books: userInfo.itemslisted,
                            platforms: platforms,
                            contactInfoExists: contactPlatform !== '' && contactInfo !== '',
                            contactPlatform: contactPlatform,
                            contactInfo: contactInfo,
                            booksListed: booksListed
                        });
                        req.session.errorMsg = undefined;
                    });
                });
            });
        });
    });
});

// Set image event
app.post('/setImage', auth, (req, res) => {
    database.getAuthUser(req.session.sessionId, (userId) => {
        database.setUserImage(userId, req.body.imageUrl, () => {
            res.redirect('/profile');
        });
    });
});

// Change password event
app.post('/changePassword', auth, (req, res) => {
    if (req.body.newPassword === req.body.confirmNewPassword) {
        var result = owasp.test(req.body.newPassword);
        if (result.errors.length === 0) {
            database.getAuthUser(req.session.sessionId, (userId) => {
                database.checkPassword(userId, req.body.currentPassword, (correct) => {
                    if (correct) {
                        database.setUserPassword(userId, req.body.newPassword, () => {
                            res.redirect('/profile');
                        });
                    } else {
                        req.session.errorMsg = 'Incorrect password';
                        res.redirect('/profile');
                    }
                });
            });
        } else {
            req.session.errorMsg = result.errors.join('\n');
            res.redirect('/profile');
        }
    } else {
        req.session.errorMsg = 'Passwords do not match';
        res.redirect('/profile');
    }
});

// Set preferred contact info
app.post('/setContactInfo', auth, (req, res) => {
    var contactPlatform = parseInt(stripWhitespace(req.body.contactPlatform));
    if (isNaN(contactPlatform)) contactPlatform = -1;
    var contactInfo = stripWhitespace(req.body.contactInfo);
    database.validPlatform(contactPlatform, (valid) => {
        if (valid) {
            if (contactInfo.length > 0 && contactInfo.length <= 128) {
                database.getAuthUser(req.session.sessionId, (userId) => {
                    database.setContactInfo(userId, contactPlatform, contactInfo, () => {
                        res.redirect('/profile');
                    });
                });
            } else {
                req.session.errorMsg = 'Contact info must be less than 128 characters.';
                res.redirect('/profile');
            }
        } else {
            req.session.errorMsg = 'Please select a valid contact platform.';
            res.redirect('/profile');
        }
    });
});

// About page
app.get('/about', (req, res) => {
    renderPage(req, res, 'about', { title: 'About NorseBooks' });
});

// Contact page
app.get('/contact', (req, res) => {
    renderPage(req, res, 'contact', { title: 'Contact Us' });
});

// Feedback form
app.get('/feedback', auth, (req, res) => {
    database.getAuthUser(req.session.sessionId, (userId) => {
        database.canProvideFeedback(userId, (can) => {
            renderPage(req, res, 'feedback', { title: 'Provide Feedback', canProvideFeedback: can });
        });
    });
});

// Feedback provided
app.post('/feedback', auth, (req, res) => {
    database.getAuthUser(req.session.sessionId, (userId, firstname, lastname) => {
        database.canProvideFeedback(userId, (can) => {
            if (can) {
                var feedback = stripWhitespace(req.body.feedback);
                while (feedback.includes('\n')) feedback = feedback.replace('\n', '<br>');
                emailer.sendEmail(emailer.emailAddress, 'User Feedback', `${firstname} ${lastname} provided the following feedback:<br><br>${feedback}<br><br>Sincerely,<br>The Norse Books Dev Team`);
                database.updateFeedbackTimestamp(userId);
            }
            res.redirect('/');
        });
    });
});

// Help out page
app.get('/help-out', (req, res) => {
    renderPage(req, res, 'help-out', { title: 'Help out' });
});

// Terms and conditions page
app.get('/terms-and-conditions', (req, res) => {
    database.getMeta('Terms and Conditions', (termsAndConditions) => {
        termsAndConditions = md.render(termsAndConditions);
        renderPage(req, res, 'terms-and-conditions', {
            title: 'Terms and conditions',
            termsAndConditions: termsAndConditions
        });
    });
});

// Admin main page
app.get('/admin', adminAuth, (req, res) => {
    database.getMeta('Max books', (maxBooks) => {
        database.getMeta('Max reports', (maxReports) => {
            database.getMeta('Books per query', (booksPerQuery) => {
                database.getMeta('Version', (version) => {
                    renderPage(req, res, 'admin', {
                        title: 'Admin',
                        maxBooks: parseInt(maxBooks),
                        maxReports: parseInt(maxReports),
                        booksPerQuery: parseInt(booksPerQuery),
                        version: version
                    });
                });
            });
        });
    });
});

// Edit version event
app.post('/setVersion', adminAuth, (req, res) => {
    database.setMeta('Version', req.body.version, () => {
        res.redirect('/admin');
    });
});

// Edit max books event
app.post('/setMaxBooks', adminAuth, (req, res) => {
    database.setMeta('Max books', req.body.maxBooks, () => {
        res.redirect('/admin');
    });
});

// Edit max reports event
app.post('/setMaxReports', adminAuth, (req, res) => {
    database.setMeta('Max reports', req.body.maxReports, () => {
        res.redirect('/admin');
    });
});

// Edit books per query event
app.post('/setBooksPerQuery', adminAuth, (req, res) => {
    database.setMeta('Books per query', req.body.booksPerQuery, () => {
        res.redirect('/admin');
    });
});

// Edit terms and conditions page
app.get('/admin/terms-and-conditions', adminAuth, (req, res) => {
    database.getMeta('Terms and Conditions', (termsAndConditions) => {
        renderPage(req, res, 'admin-tac', { title: 'Edit terms and conditions', termsAndConditions: termsAndConditions });
    });
});

// Edit terms and conditions event
app.post('/admin/terms-and-conditions', adminAuth, (req, res) => {
    database.setMeta('Terms and Conditions', req.body.tac, () => {
        res.redirect('/admin/terms-and-conditions');
    });
});

// Error 404 (not found)
app.use((req, res) => {
    renderPage(req, res, '404', { title: 'Not found' });
});

// Error 500 (internal server error)
app.use((req, res) => {
    renderPage(req, res, '500', { title: 'Internal server error' });
});

// Listen for connections
app.listen(port, () => {
    console.log(`App running on port ${port}`);
});

module.exports = app;
