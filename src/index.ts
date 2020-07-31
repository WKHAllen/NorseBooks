import * as express        from 'express';
import * as enforce        from 'express-sslify';
import * as hbs            from 'express-handlebars';
import * as session        from 'express-session';
import * as bodyParser     from 'body-parser';
import * as owasp          from 'owasp-password-strength-test';
import * as randomPassword from 'secure-random-password';
import * as multer         from 'multer';
import * as cloudinary     from 'cloudinary';
import * as showdown       from 'showdown';
import * as fs             from 'fs';
import * as database       from './database';
import * as emailer        from './emailer';

type Request      = express.Request;
type Response     = express.Response;
type NextFunction = express.NextFunction;

const debug               = Boolean(Number(process.env.DEBUG));
const port                = Number(process.env.PORT);
const sessionSecret       = process.env.SESSION_SECRET;
const cloudinaryName      = process.env.CLOUDINARY_NAME;
const cloudinaryApiKey    = process.env.CLOUDINARY_API_KEY;
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;

const emailsDir = 'emails';
const registrationEmailHTML  = `${emailsDir}/confirmEmail.html`;
const registrationEmailText  = `${emailsDir}/confirmEmail.txt`;
const passwordResetEmailHTML = `${emailsDir}/passwordReset.html`;
const passwordResetEmailText = `${emailsDir}/passwordReset.txt`;

const ISBNChars = '0123456789X';

var converter = new showdown.Converter();

var storage = multer.diskStorage({
    filename: function(req, file, callback) {
        callback(null, Date.now() + file.originalname);
    }
});

var upload = multer({ storage: storage });

cloudinary.v2.config({
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
    // defaultView: 'default',
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
function stripWhitespace(str: string): string {
    if (!str && str !== '') return '';
    return str.replace(/^\s+|\s+$/g, '');
}

// Add trailing zeros and commas as thousands separators
function formatPrice(num: number | string): string {
    if (typeof num === 'number') {
        num = num.toString();
    }
    return '$' + num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Get the hostname of a request
function getHostname(req: Request): string {
    return `${req.protocol}://${req.get('host')}`;
}

// Generate a random password
function newRandomPassword(): string {
    var examplePassword = randomPassword.randomPassword({ length: 10, characters: [
        randomPassword.lower, randomPassword.upper, randomPassword.digits, randomPassword.symbols
    ]});
    return examplePassword;
}

// Replace placeholders in strings
function replacePlaceholders(str: string, ...values: string[]): string {
    for (var value of values)
        str = str.replace('{}', value);
    return str;
}

// Send a registration verification email
function sendEmailVerification(email: string, hostname: string) {
    email = email.toLowerCase();
    database.newVerifyId(email, (verifyId) => {
        fs.readFile(registrationEmailHTML, { encoding: 'utf-8' }, (err, htmlData) => {
            if (err) throw err;
            fs.readFile(registrationEmailText, { encoding: 'utf-8' }, (err, textData) => {
                if (err) throw err;
                htmlData = replacePlaceholders(htmlData, hostname, verifyId);
                textData = replacePlaceholders(textData, hostname, verifyId);
                emailer.sendEmail(email + '@luther.edu', 'Norse Books - Verify Email', htmlData, textData);
            });
        });
    });
}

// Send a password reset email
function sendPasswordResetEmail(email: string, hostname: string) {
    email = email.toLowerCase();
    database.newPasswordResetId(email, (passwordResetId) => {
        fs.readFile(passwordResetEmailHTML, { encoding: 'utf-8' }, (err, htmlData) => {
            if (err) throw err;
            fs.readFile(passwordResetEmailText, { encoding: 'utf-8' }, (err, textData) => {
                if (err) throw err;
                htmlData = replacePlaceholders(htmlData, hostname, passwordResetId);
                textData = replacePlaceholders(textData, hostname, passwordResetId);
                emailer.sendEmail(email + '@luther.edu', 'Norse Books - Password Reset', htmlData, textData);
            });
        });
    });
}

// Remove unnecessary characters from an ISBN
function minISBN(ISBN: string): string {
    while (ISBN.includes('-')) ISBN = ISBN.replace('-', '');
    while (ISBN.includes(' ')) ISBN = ISBN.replace(' ', '');
    return ISBN;
}

// Check if an ISBN is valid
function validISBN(ISBN: string): boolean {
    if (ISBN.length !== 10 && ISBN.length !== 13) return false;
    for (var char of ISBN)
        if (!ISBNChars.includes(char))
            return false;
    return true;
}

interface bookForm {
    title:        string,
    author:       string,
    department:   string,
    courseNumber: string,
    price:        string,
    condition:    string,
    imageUrl:     string,
    description:  string,
    ISBN10:       string,
    ISBN13:       string
}

interface bookObject {
    title:        string,
    author:       string,
    department:   number,
    courseNumber: number,
    price:        number,
    condition:    number,
    imageUrl:     string,
    description:  string,
    ISBN10:       string,
    ISBN13:       string
}

// Check if a book form is valid
function validBook(form: bookForm, callback: (success: boolean, error: string, book?: bookObject) => void) {
    var title = stripWhitespace(form.title);
    var author = stripWhitespace(form.author);
    var department = parseInt(stripWhitespace(form.department));
    var courseNumber = parseInt(stripWhitespace(form.courseNumber));
    var price = Math.floor(parseFloat(stripWhitespace(form.price.replace('$', ''))) * 100) / 100;
    var condition = parseInt(stripWhitespace(form.condition));
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
const auth = (req: Request, res: Response, next: NextFunction) => {
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
const adminAuth = (req: Request, res: Response, next: NextFunction) => {
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
function renderPage(req: Request, res: Response, page: string, options: any) {
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
app.get('/', (req: Request, res: Response) => {
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

interface bookSearchOptions {
    title?: string,
    author?: string,
    departmentId?: number,
    courseNumber?: number,
    ISBN?: string
}

// Get more books to populate the index page
app.get('/getBooks', (req: Request, res: Response) => {
    database.validBook(req.query.lastBook as string, (exists) => {
        if (exists || !req.query.lastBook) {
            // title
            var title = stripWhitespace(req.query.title as string);
            // author
            var author = stripWhitespace(req.query.author as string);
            // department
            var department = parseInt(stripWhitespace(req.query.department as string));
            if (isNaN(department)) department = null;
            // course number
            var courseNumber = parseInt(stripWhitespace(req.query.courseNumber as string));
            // ISBN
            var ISBN = minISBN(stripWhitespace(req.query.ISBN as string).toUpperCase());
            // sort
            var sort = parseInt(stripWhitespace(req.query.sort as string));
            if (isNaN(sort)) sort = null;
            var searchOptions: bookSearchOptions = {};
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
                    database.searchBooks(searchOptions, sort, req.query.lastBook as string, (rows) => {
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
app.get('/login', (req: Request, res: Response) => {
    renderPage(req, res, 'login', { title: 'Login' });
});

// Login event
app.post('/login', (req: Request, res: Response) => {
    database.validLogin(req.body.email.replace('@luther.edu', ''), req.body.password, (valid, sessionId) => {
        if (valid) {
            req.session.sessionId = sessionId;
            if (req.query.after)
                res.redirect(req.query.after as string);
            else
                res.redirect('/');
        } else {
            renderPage(req, res, 'login', { title: 'Login', error: 'Invalid login' });
        }
    });
});

// Registration page
app.get('/register', (req: Request, res: Response) => {
    renderPage(req, res, 'register', { title: 'Register', passwordExample: newRandomPassword() });
});

// Registration event
app.post('/register', (req: Request, res: Response) => {
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
app.get('/logout', (req: Request, res: Response) => {
    database.deleteSession(req.session.sessionId, () => {
        req.session.destroy(() => {
            res.redirect('/login');
        });
    });
});

// After registering
app.get('/register-success', (req: Request, res: Response) => {
    renderPage(req, res, 'register-success', { title: 'Successfully registered' });
});

// Verify email address page
app.get('/verify/:verifyId', (req: Request, res: Response) => {
    database.checkVerifyId(req.params.verifyId, (valid) => {
        renderPage(req, res, 'verify', { title: 'Verify', valid: valid });
        if (valid) {
            database.setVerified(req.params.verifyId, () => {
                database.deleteVerifyId(req.params.verifyId);
            });
        }
    });
});

// Request password reset page
app.get('/password-reset', (req: Request, res: Response) => {
    renderPage(req, res, 'password-reset-request', { title: 'Password reset request' });
});

// Request password reset event
app.post('/password-reset', (req: Request, res: Response) => {
    var email = stripWhitespace(req.body.email).replace('@luther.edu', '');
    renderPage(req, res, 'password-reset-request-success', { title: 'Password reset request' });
    database.passwordResetExists(email, (exists) => {
        if (!exists) {
            sendPasswordResetEmail(email, getHostname(req));
        }
    });
});

// Password reset page
app.get('/password-reset/:passwordResetId', (req: Request, res: Response) => {
    database.checkPasswordResetId(req.params.passwordResetId, (valid) => {
        renderPage(req, res, 'password-reset', { title: 'Reset password', valid: valid, passwordExample: newRandomPassword() });
    });
});

// Password reset event
app.post('/password-reset/:passwordResetId', (req: Request, res: Response) => {
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
app.get('/book', auth, (req: Request, res: Response) => {
    database.getAuthUser(req.session.sessionId, (userId) => {
        database.getNumUserBooks(userId, (numBooks) => {
            database.getMeta('Max books', (maxNumBooks) => {
                var numMaxNumBooks = parseInt(maxNumBooks);
                if (numBooks < numMaxNumBooks) {
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
app.post('/book', auth, upload.single('image'), (req: Request, res: Response) => {
    cloudinary.v2.uploader.upload(req.file.path, (cloudinaryErr, result) => {
        validBook(req.body, (valid, err, values) => {
            if (valid && !cloudinaryErr) {
                database.getAuthUser(req.session.sessionId, (userId) => {
                    database.newBook(values.title, values.author, values.department, values.courseNumber || null, values.condition, values.description, userId, values.price, result.secure_url || null, values.ISBN10 || null, values.ISBN13 || null, (bookId) => {
                        res.redirect(`/book/${bookId}`);
                    });
                });
            } else {
                database.getDepartments((departments) => {
                    database.getConditions((conditions) => {
                        renderPage(req, res, 'new-book', {
                            title: 'New book',
                            departments: departments,
                            conditions: conditions,
                            error: err || 'Error uploading image. Please try a different image.',
                            form: {
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
                            }
                        });
                    });
                });
            }
        });
    });
});

// View a book
app.get('/book/:bookId', (req: Request, res: Response) => {
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
app.get('/edit/:bookId', auth, (req: Request, res: Response) => {
    database.validBook(req.params.bookId, (valid) => {
        if (valid) {
            database.getAuthUser(req.session.sessionId, (userId) => {
                database.getUserBookInfo(req.params.bookId, (userBookInfo) => {
                    if (userId === userBookInfo.id) {
                        database.getBookInfo(req.params.bookId, (bookInfo) => {
                            database.getDepartments((departments) => {
                                database.getConditions((conditions) => {
                                    renderPage(req, res, 'edit', {
                                        title: 'Edit book',
                                        departments: departments,
                                        conditions: conditions,
                                        error: req.session.errorMsg || undefined,
                                        form: {
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
                                        }
                                    });
                                    req.session.errorMsg = undefined;
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
app.post('/edit/:bookId', auth, upload.single('image'), (req: Request, res: Response) => {
    validBook(req.body, (valid, err, values) => {
        if (valid) {
            if (req.file) {
                cloudinary.v2.uploader.upload(req.file.path, (cloudinaryErr, result) => {
                    if (!cloudinaryErr) {
                        database.getAuthUser(req.session.sessionId, (userId) => {
                            database.editBook(req.params.bookId, values.title, values.author, values.department, values.courseNumber || null, values.condition, values.description, userId, values.price, result.secure_url || null, values.ISBN10 || null, values.ISBN13 || null, () => {
                                res.redirect(`/book/${req.params.bookId}`);
                            });
                        });
                    } else {
                        req.session.errorMsg = 'Error uploading image. Please try a different image.';
                        res.redirect(`/edit/${req.params.bookId}`);
                    }
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
app.post('/deleteBook/:bookId', auth, (req: Request, res: Response) => {
    database.getAuthUser(req.session.sessionId, (userId) => {
        database.getBookInfo(req.params.bookId, (bookInfo) => {
            database.deleteBook(userId, bookInfo.id, () => {
                res.redirect('/');
            });
        });
    });
});

// Book sold event
app.post('/bookSold/:bookId', auth, (req: Request, res: Response) => {
    database.getAuthUser(req.session.sessionId, (userId) => {
        database.getBookInfo(req.params.bookId, (bookInfo) => {
            database.bookSold(userId, bookInfo.id, () => {
                res.redirect('/');
            });
        });
    });
});

// Report book event
app.post('/reportBook/:bookId', auth, (req: Request, res: Response) => {
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
app.get('/profile', auth, (req: Request, res: Response) => {
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
                            itemsSold: userInfo.itemssold,
                            moneyMade: formatPrice(userInfo.moneymade),
                            books: userInfo.itemslisted,
                            platforms: platforms,
                            contactInfoExists: contactPlatform !== '' && contactInfo !== '',
                            contactPlatform: contactPlatform,
                            contactInfo: contactInfo,
                            booksListed: booksListed,
                            hasListings: booksListed.length > 0
                        });
                        req.session.errorMsg = undefined;
                    });
                });
            });
        });
    });
});

// Set name event
app.post('/setName', auth, (req: Request, res: Response) => {
    var fname = stripWhitespace(req.body.firstname);
    var lname = stripWhitespace(req.body.lastname);
    if (fname.length > 0 && fname.length <= 64 && lname.length > 0 && lname.length <= 64) {
        database.getAuthUser(req.session.sessionId, (userId) => {
            database.setUserName(userId, fname, lname, () => {
                res.redirect('/profile');
            });
        });
    } else {
        req.session.errorMsg = 'Invalid name';
        res.redirect('/profile');
    }
});

// Set image event
app.post('/setImage', auth, (req: Request, res: Response) => {
    database.getAuthUser(req.session.sessionId, (userId) => {
        database.setUserImage(userId, req.body.imageUrl, () => {
            res.redirect('/profile');
        });
    });
});

// Change password event
app.post('/changePassword', auth, (req: Request, res: Response) => {
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
app.post('/setContactInfo', auth, (req: Request, res: Response) => {
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
app.get('/about', (req: Request, res: Response) => {
    renderPage(req, res, 'about', { title: 'About NorseBooks' });
});

// Contact page
app.get('/contact', (req: Request, res: Response) => {
    renderPage(req, res, 'contact', { title: 'Contact Us' });
});

// Feedback form
app.get('/feedback', auth, (req: Request, res: Response) => {
    database.getAuthUser(req.session.sessionId, (userId) => {
        database.canProvideFeedback(userId, (can) => {
            renderPage(req, res, 'feedback', { title: 'Provide Feedback', canProvideFeedback: can });
        });
    });
});

// Feedback provided
app.post('/feedback', auth, (req: Request, res: Response) => {
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
app.get('/help-out', (req: Request, res: Response) => {
    renderPage(req, res, 'help-out', { title: 'Help out' });
});

// Terms and conditions page
app.get('/terms-and-conditions', (req: Request, res: Response) => {
    database.getMeta('Terms and Conditions', (termsAndConditions) => {
        termsAndConditions = converter.makeHtml(termsAndConditions);
        renderPage(req, res, 'terms-and-conditions', {
            title: 'Terms and conditions',
            termsAndConditions: termsAndConditions
        });
    });
});

// Admin main page
app.get('/admin', adminAuth, (req: Request, res: Response) => {
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

// Get admin page stats
app.get('/getAdminStats', adminAuth, (req: Request, res: Response) => {
    database.getNumUsers((numUsers) => {
        database.getNumBooks((numBooks) => {
            database.getNumSold((numSold) => {
                database.getTotalListed((totalListed) => {
                    database.getTotalMoneyMade((totalMoneyMade) => {
                        database.getNumTables((numTables) => {
                            database.getNumRows((numRows) => {
                                database.getNumReports((numReports) => {
                                    var rowsPercentage = Math.floor(numRows / 10000 * 100 * 10) / 10;
                                    res.json({
                                        numUsers: numUsers,
                                        numBooks: numBooks,
                                        numSold: numSold,
                                        totalListed: totalListed,
                                        totalMoneyMade: formatPrice(totalMoneyMade),
                                        numTables: numTables,
                                        numRows: numRows,
                                        rowsPercentage: rowsPercentage,
                                        numReports: numReports
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// Edit version event
app.post('/setVersion', adminAuth, (req: Request, res: Response) => {
    database.setMeta('Version', req.body.version, () => {
        res.redirect('/admin');
    });
});

// Edit max books event
app.post('/setMaxBooks', adminAuth, (req: Request, res: Response) => {
    database.setMeta('Max books', req.body.maxBooks, () => {
        res.redirect('/admin');
    });
});

// Edit max reports event
app.post('/setMaxReports', adminAuth, (req: Request, res: Response) => {
    database.setMeta('Max reports', req.body.maxReports, () => {
        res.redirect('/admin');
    });
});

// Edit books per query event
app.post('/setBooksPerQuery', adminAuth, (req: Request, res: Response) => {
    database.setMeta('Books per query', req.body.booksPerQuery, () => {
        res.redirect('/admin');
    });
});

// Edit terms and conditions page
app.get('/admin/terms-and-conditions', adminAuth, (req: Request, res: Response) => {
    database.getMeta('Terms and Conditions', (termsAndConditions) => {
        renderPage(req, res, 'admin-tac', { title: 'Edit terms and conditions', termsAndConditions: termsAndConditions });
    });
});

// Edit terms and conditions event
app.post('/admin/terms-and-conditions', adminAuth, (req: Request, res: Response) => {
    database.setMeta('Terms and Conditions', req.body.tac, () => {
        res.redirect('/admin/terms-and-conditions');
    });
});

// Pseudo-query page
app.get('/admin/query', adminAuth, (req: Request, res: Response) => {
    renderPage(req, res, 'admin-query', { title: 'Query' });
});

// Get the database tables
app.get('/getDBTables', adminAuth, (req: Request, res: Response) => {
    database.getTables((tables) => {
        res.json({ tables: tables });
    });
});

// Get the columns of a single table in the database
app.get('/getDBColumns', adminAuth, (req: Request, res: Response) => {
    database.getColumns(req.query.table as string, (columns) => {
        res.json({ columns: columns });
    })
});

// Execute a select statement on the database
app.get('/executeSelect', adminAuth, (req: Request, res: Response) => {
    database.executeSelect(req.query.queryInputs, (rows) => {
        res.json({ result: rows });
    });
});

// View reports page
app.get('/admin/reports', adminAuth, (req: Request, res: Response) => {
    database.getReports((reports) => {
        renderPage(req, res, 'admin-reports', { reports: reports });
    });
});

// Site alert page
app.get('/admin/alert', adminAuth, (req: Request, res: Response) => {
    database.getMeta('Alert', (alertValue) => {
        database.getMeta('Alert timeout', (alertTimeout) => {
            if (alertValue !== null && alertTimeout !== null) {
                var remaining = Math.floor(parseInt(alertTimeout) - (new Date().getTime() / 1000));
                if (remaining > 0) {
                    var days = Math.floor(remaining / (60 * 60 * 24));
                    var hours = Math.floor((remaining - (days * 60 * 60 * 24)) / (60 * 60));
                    var minutes = Math.floor((remaining - (days * 60 * 60 * 24) - (hours * 60 * 60)) / 60);
                    var seconds = remaining - (days * 60 * 60 * 24) - (hours * 60 * 60) - (minutes * 60);
                    renderPage(req, res, 'admin-alert', {
                        alertValue: alertValue,
                        days: days,
                        hours: hours,
                        minutes: minutes,
                        seconds: seconds,
                        alertTimeout: alertTimeout,
                        error: req.session.errorMsg || undefined
                    });
                } else {
                    renderPage(req, res, 'admin-alert', { error: req.session.errorMsg || undefined });
                }
            } else {
                renderPage(req, res, 'admin-alert', { error: req.session.errorMsg || undefined });
            }
            req.session.errorMsg = undefined;
        });
    });
});

// Set alert event
app.post('/admin/alert', adminAuth, (req: Request, res: Response) => {
    var days = parseInt(req.body.days);
    var hours = parseInt(req.body.hours);
    var minutes = parseInt(req.body.minutes);
    var seconds = parseInt(req.body.seconds);
    if (isNaN(days) || isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
        req.session.errorMsg = 'Days, hours, minutes, and seconds must all be integers';
        res.redirect('/admin/alert');
    } else {
        if (hours < 0 || hours >= 24) {
            req.session.errorMsg = 'Hours must be between 0 and 23';
            res.redirect('/admin/alert');
        } else if (minutes < 0 || minutes >= 60) {
            req.session.errorMsg = 'Minutes must be between 0 and 59';
            res.redirect('/admin/alert');
        } else if (minutes < 0 || seconds >= 60) {
            req.session.errorMsg = 'Seconds must be between 0 and 59';
            res.redirect('/admin/alert');
        } else {
            var timeout = (days * 60 * 60 * 24) + (hours * 60 * 60) + (minutes * 60) + seconds;
            var timeoutTimestamp = Math.floor(new Date().getTime() / 1000) + timeout;
            database.setMeta('Alert', req.body.alertValue, () => {
                database.setMeta('Alert timeout', timeoutTimestamp.toString(), () => {
                    res.redirect('/admin/alert');
                });
            });
        }
    }
});

// Remove alert event
app.post('/removeAlert', adminAuth, (req: Request, res: Response) => {
    database.setMeta('Alert', null, () => {
        res.redirect('/admin/alert');
    });
});

// Get the current alert
app.get('/getAlert', (req: Request, res: Response) => {
    database.getMeta('Alert timeout', (alertTimeout) => {
        if (Math.floor(parseInt(alertTimeout) - (new Date().getTime() / 1000)) > 0) {
            database.getMeta('Alert', (alertValue) => {
                res.json({ alertValue: alertValue });
            });
        } else {
            res.json({});
        }
    });
});

// Admin users page
app.get('/admin/users', adminAuth, (req: Request, res: Response) => {
    var orderBy = req.query.orderBy as string || 'joinTimestamp';
    var orderDirection = req.query.orderDirection as string || 'ASC';
    database.getUsers(orderBy, orderDirection, (users) => {
        renderPage(req, res, 'admin-users', { users: users, orderBy: orderBy, orderDirection: orderDirection });
    });
});

// Error 404 (not found)
app.use((req: Request, res: Response) => {
    renderPage(req, res, '404', { title: 'Not found' });
});

// Error 500 (internal server error)
app.use((req: Request, res: Response) => {
    renderPage(req, res, '500', { title: 'Internal server error' });
});

// Listen for connections
app.listen(port, () => {
    console.log(`App running on port ${port}`);
});

module.exports = app;
