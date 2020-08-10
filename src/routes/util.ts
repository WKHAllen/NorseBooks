import * as express        from 'express';
import * as multer         from 'multer';
import * as randomPassword from 'secure-random-password';
import * as fs             from 'fs';
import * as services       from '../services';
import * as emailer        from '../emailer';

export type Request      = express.Request;
export type Response     = express.Response;
export type NextFunction = express.NextFunction;

export const cloudinaryName      = process.env.CLOUDINARY_NAME;
export const cloudinaryApiKey    = process.env.CLOUDINARY_API_KEY;
export const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;

const emailsDir = 'emails';
const registrationEmailHTML  = `${emailsDir}/confirmEmail.html`;
const registrationEmailText  = `${emailsDir}/confirmEmail.txt`;
const passwordResetEmailHTML = `${emailsDir}/passwordReset.html`;
const passwordResetEmailText = `${emailsDir}/passwordReset.txt`;

const ISBNChars = '0123456789X';

var storage = multer.diskStorage({
    filename: function(req, file, callback) {
        callback(null, Date.now() + file.originalname);
    }
});

export var upload = multer({ storage: storage });

// Removes whitespace from the ends of a string
export function stripWhitespace(str: string): string {
    if (!str && str !== '') return '';
    return str.replace(/^\s+|\s+$/g, '');
}

// Add trailing zeros and commas as thousands separators
export function formatPrice(num: number | string): string {
    if (typeof num === 'number') {
        num = num.toString();
    }
    return '$' + num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Get the hostname of a request
export function getHostname(req: Request): string {
    return `${req.protocol}://${req.get('host')}`;
}

// Generate a random password
export function newRandomPassword(): string {
    var examplePassword = randomPassword.randomPassword({ length: 10, characters: [
        randomPassword.lower, randomPassword.upper, randomPassword.digits, randomPassword.symbols
    ]});
    return examplePassword;
}

// Replace placeholders in strings
export function replacePlaceholders(str: string, ...values: string[]): string {
    for (var value of values)
        str = str.replace('{}', value);
    return str;
}

// Send a registration verification email
export function sendEmailVerification(email: string, hostname: string) {
    email = email.toLowerCase();
    services.VerificationService.newVerifyId(email, (verifyId) => {
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
export function sendPasswordResetEmail(email: string, hostname: string) {
    email = email.toLowerCase();
    services.PasswordResetService.newPasswordResetId(email, (passwordResetId) => {
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
export function minISBN(ISBN: string): string {
    while (ISBN.includes('-')) ISBN = ISBN.replace('-', '');
    while (ISBN.includes(' ')) ISBN = ISBN.replace(' ', '');
    return ISBN;
}

// Check if an ISBN is valid
export function validISBN(ISBN: string): boolean {
    if (ISBN.length !== 10 && ISBN.length !== 13) return false;
    for (var char of ISBN)
        if (!ISBNChars.includes(char))
            return false;
    return true;
}

interface BookForm {
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

interface BookObject {
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
export function validBook(form: BookForm, callback: (success: boolean, error: string, book?: BookObject) => void) {
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
            services.DepartmentService.validDepartment(department, (valid) => {
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
                            services.ConditionService.validCondition(condition, (valid) => {
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
                                            if (ISBN10.length > 0 && (ISBN10.length !== 10 || !validISBN(ISBN10))) {
                                                callback(false, 'Please enter a valid ISBN-10.');
                                            } else {
                                                // Check ISBN13
                                                if (ISBN13.length > 0 && (ISBN13.length !== 13 || !validISBN(ISBN13))) {
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

// Get a cloudinary image's public ID
export function imagePublicId(imageUrl: string): string {
    var idStart = imageUrl.lastIndexOf('/') + 1;
    var idEnd = imageUrl.lastIndexOf('.');
    return imageUrl.slice(idStart, idEnd);
}

// Log an error if it occurs when attempting to destroy a cloudinary image
export function logCloudinaryDestroyError(imageUrl: string, err: any, result: any) {
    if (err || result.result !== 'ok') {
        console.log('ERROR DESTROYING CLOUDINARY IMAGE');
        console.log('Image URL:', imageUrl);
        console.log('Image ID: ', imagePublicId(imageUrl));
        console.log('Error:    ', err);
        console.log('Result:   ', result);
    }
}

// Transform book image URLs to load smaller images from cloudinary
export function smallerImageURL(imageUrl: string, width: number = 300) {
    const imgStart = 'https://res.cloudinary.com/norsebooks/image/upload';
    if (imageUrl.startsWith(imgStart)) {
        var imgEnd = imageUrl.slice(imgStart.length + 1);
        return `${imgStart}/w_${width}/${imgEnd}`;
    } else {
        return imageUrl;
    }
}

// Authorize/authenticate
export function auth(req: Request, res: Response, next: NextFunction) {
    if (!req.session || !req.session.sessionId) {
        return renderPage(req, res, '401', { title: 'Permission denied', after: req.originalUrl }, 401);
    } else {
        services.AuthService.auth(req.session.sessionId, (valid) => {
            if (valid) next();
            else return renderPage(req, res, '401', { title: 'Permission denied', after: req.originalUrl }, 401);
        });
    }
}

// Authenticate an admin
export function adminAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.session || !req.session.sessionId) {
        return renderPage(req, res, '401', { title: 'Permission denied', after: req.originalUrl }, 401);
    } else {
        services.AuthService.auth(req.session.sessionId, (valid) => {
            if (valid) {
                services.AuthService.getAuthUser(req.session.sessionId, (userId) => {
                    services.UserService.isAdmin(userId, (admin) => {
                        if (admin) next();
                        else return renderPage(req, res, 'not-admin', { title: 'Permission denied', after: req.originalUrl }, 401);
                    });
                });
            } else {
                return renderPage(req, res, '401', { title: 'Permission denied', after: req.originalUrl }, 401);
            }
        });
    }
}

// Render a page
export function renderPage(req: Request, res: Response, page: string, options: any, status: number = 200) {
    options = options || {};
    options.url = req.originalUrl;
    services.MetaService.getMeta('Version', (version) => {
        options.version = version;
        if (!req.session || !req.session.sessionId) {
            options.loggedIn = false;
            return res.status(status).render(page, options);
        } else {
            services.MiscService.getNavInfo(req.session.sessionId, (result) => {
                if (!result) {
                    options.loggedIn = false;
                    return res.status(status).render(page, options);
                } else {
                    options.loggedIn = true;
                    options.userId = result.userid;
                    options.userFirstName = result.firstname;
                    options.admin = result.admin;
                    return res.status(status).render(page, options);
                }
            });
        }
    });
}
