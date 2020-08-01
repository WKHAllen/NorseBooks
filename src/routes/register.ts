import { Router } from 'express';
import { renderPage, Request, Response, stripWhitespace, getHostname, newRandomPassword, sendEmailVerification } from './util';
import * as services from '../services';
import * as owasp from 'owasp-password-strength-test';

export var router = Router();

// Registration page
router.get('/', (req: Request, res: Response) => {
    renderPage(req, res, 'register', { title: 'Register', passwordExample: newRandomPassword() });
});

// Registration event
router.post('/', (req: Request, res: Response) => {
    var email = stripWhitespace(req.body.email).replace('@luther.edu', '');
    var fname = stripWhitespace(req.body.firstname);
    var lname = stripWhitespace(req.body.lastname);
    services.UserService.userExists(email, (exists) => {
        if (!exists) {
            if (email.length <= 64) {
                if (req.body.password === req.body.passwordConfirm) {
                    var result = owasp.test(req.body.password);
                    if (result.errors.length === 0) {
                        if (fname.length > 0 && fname.length <= 64 && lname.length > 0 && lname.length <= 64) {
                            services.LoginRegisterService.register(email, req.body.password, fname, lname);
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
