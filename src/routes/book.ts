import { Router } from 'express';
import { renderPage, Request, Response, auth, validBook, upload, cloudinaryName, cloudinaryApiKey, cloudinaryApiSecret } from './util';
import * as services from '../services';
import * as cloudinary from 'cloudinary';

cloudinary.v2.config({
    cloud_name: cloudinaryName,
    api_key:    cloudinaryApiKey,
    api_secret: cloudinaryApiSecret
});

export var router = Router();

// List new book page
router.get('/', auth, (req: Request, res: Response) => {
    services.AuthService.getAuthUser(req.session.sessionId, (userId) => {
        services.BookService.getNumUserBooks(userId, (numBooks) => {
            services.MetaService.getMeta('Max books', (maxNumBooks) => {
                var numMaxNumBooks = parseInt(maxNumBooks);
                if (numBooks < numMaxNumBooks) {
                    services.UserService.hasContactInfo(userId, (hasInfo) => {
                        if (hasInfo) {
                            services.DepartmentService.getDepartments((departments) => {
                                services.ConditionService.getConditions((conditions) => {
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
router.post('/', auth, upload.single('image'), (req: Request, res: Response) => {
    cloudinary.v2.uploader.upload(req.file.path, (cloudinaryErr, result) => {
        validBook(req.body, (valid, err, values) => {
            if (valid && !cloudinaryErr) {
                services.AuthService.getAuthUser(req.session.sessionId, (userId) => {
                    services.BookService.newBook(values.title, values.author, values.department, values.courseNumber || null, values.condition, values.description, userId, values.price, result.secure_url || null, values.ISBN10 || null, values.ISBN13 || null, (bookId) => {
                        res.redirect(`/book/${bookId}`);
                    });
                });
            } else {
                services.DepartmentService.getDepartments((departments) => {
                    services.ConditionService.getConditions((conditions) => {
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
router.get('/:bookId', (req: Request, res: Response) => {
    services.BookService.validBook(req.params.bookId, (valid) => {
        if (valid) {
            services.BookService.getBookInfo(req.params.bookId, (bookInfo) => {
                services.BookService.getUserBookInfo(req.params.bookId, (userBookInfo) => {
                    services.DepartmentService.getDepartmentName(bookInfo.departmentid, (department) => {
                        services.ConditionService.getConditionName(bookInfo.conditionid, (condition) => {
                            services.PlatformService.getPlatformName(userBookInfo.contactplatformid, (platform) => {
                                services.AuthService.getAuthUser(req.session.sessionId, (userId) => {
                                    services.ReportService.userReportedBook(userId, bookInfo.id, (alreadyReported) => {
                                        services.ReportService.userReportedRecently(userId, (reportedRecently) => {
                                            renderPage(req, res, 'book', {
                                                title: bookInfo.title,
                                                author: bookInfo.author,
                                                department: department,
                                                courseNumber: bookInfo.coursenumber,
                                                price: bookInfo.price,
                                                condition: condition,
                                                ISBN10: bookInfo.isbn10,
                                                ISBN13: bookInfo.isbn13,
                                                description: bookInfo.description,
                                                firstname: userBookInfo.firstname,
                                                lastname: userBookInfo.lastname,
                                                contactPlatform: platform,
                                                contactInfo: userBookInfo.contactinfo,
                                                ownerUserId: userBookInfo.userid,
                                                bookOwner: userId === userBookInfo.id,
                                                bookId: req.params.bookId,
                                                reported: alreadyReported,
                                                canReport: !reportedRecently
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
