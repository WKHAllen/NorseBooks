import { Router } from 'express';
import { renderPage, Request, Response, auth, stripWhitespace, formatPrice } from './util';
import * as services from '../services';
import * as owasp from 'owasp-password-strength-test';

export var router = Router();

// Profile viewing/editing page
router.get('/', auth, (req: Request, res: Response) => {
    services.AuthService.getAuthUser(req.session.sessionId, (userId) => {
        services.UserService.getUserInfo(userId, (userInfo) => {
            services.UserService.getContactInfo(userId, (userContactInfo) => {
                services.PlatformService.getPlatforms((platforms) => {
                    services.UserService.getUserBooks(userId, (booksListed) => {
                        services.UserService.getUserBookReports(userId, (booksReported) => {
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
                                hasListings: booksListed.length > 0,
                                booksReported: booksReported,
                                hasReports: booksReported.length > 0
                            });
                            req.session.errorMsg = undefined;
                        });
                    });
                });
            });
        });
    });
});

// Set name event
router.post('/setName', auth, (req: Request, res: Response) => {
    var fname = stripWhitespace(req.body.firstname);
    var lname = stripWhitespace(req.body.lastname);
    if (fname.length > 0 && fname.length <= 64 && lname.length > 0 && lname.length <= 64) {
        services.AuthService.getAuthUser(req.session.sessionId, (userId) => {
            services.UserService.setUserName(userId, fname, lname, () => {
                res.redirect('/profile');
            });
        });
    } else {
        req.session.errorMsg = 'Invalid name';
        res.redirect('/profile');
    }
});

// Set image event
router.post('/setImage', auth, (req: Request, res: Response) => {
    services.AuthService.getAuthUser(req.session.sessionId, (userId) => {
        services.UserService.setUserImage(userId, req.body.imageUrl, () => {
            res.redirect('/profile');
        });
    });
});

// Change password event
router.post('/changePassword', auth, (req: Request, res: Response) => {
    if (req.body.newPassword === req.body.confirmNewPassword) {
        var result = owasp.test(req.body.newPassword);
        if (result.errors.length === 0) {
            services.AuthService.getAuthUser(req.session.sessionId, (userId) => {
                services.UserService.checkPassword(userId, req.body.currentPassword, (correct) => {
                    if (correct) {
                        services.UserService.setUserPassword(userId, req.body.newPassword, () => {
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
router.post('/setContactInfo', auth, (req: Request, res: Response) => {
    var contactPlatform = parseInt(stripWhitespace(req.body.contactPlatform));
    if (isNaN(contactPlatform)) contactPlatform = -1;
    var contactInfo = stripWhitespace(req.body.contactInfo);
    services.PlatformService.validPlatform(contactPlatform, (valid) => {
        if (valid) {
            if (contactInfo.length > 0 && contactInfo.length <= 128) {
                services.AuthService.getAuthUser(req.session.sessionId, (userId) => {
                    services.UserService.setContactInfo(userId, contactPlatform, contactInfo, () => {
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
