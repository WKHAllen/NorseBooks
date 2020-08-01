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

// Edit book page
router.get('/:bookId', auth, (req: Request, res: Response) => {
    services.BookService.validBook(req.params.bookId, (valid) => {
        if (valid) {
            services.AuthService.getAuthUser(req.session.sessionId, (userId) => {
                services.BookService.getUserBookInfo(req.params.bookId, (userBookInfo) => {
                    if (userId === userBookInfo.id) {
                        services.BookService.getBookInfo(req.params.bookId, (bookInfo) => {
                            services.DepartmentService.getDepartments((departments) => {
                                services.ConditionService.getConditions((conditions) => {
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
router.post('/:bookId', auth, upload.single('image'), (req: Request, res: Response) => {
    validBook(req.body, (valid, err, values) => {
        if (valid) {
            if (req.file) {
                cloudinary.v2.uploader.upload(req.file.path, (cloudinaryErr, result) => {
                    if (!cloudinaryErr) {
                        services.AuthService.getAuthUser(req.session.sessionId, (userId) => {
                            services.BookService.editBook(req.params.bookId, values.title, values.author, values.department, values.courseNumber || null, values.condition, values.description, userId, values.price, result.secure_url || null, values.ISBN10 || null, values.ISBN13 || null, () => {
                                res.redirect(`/book/${req.params.bookId}`);
                            });
                        });
                    } else {
                        req.session.errorMsg = 'Error uploading image. Please try a different image.';
                        res.redirect(`/edit/${req.params.bookId}`);
                    }
                });
            } else {
                services.AuthService.getAuthUser(req.session.sessionId, (userId) => {
                    services.BookService.editBook(req.params.bookId, values.title, values.author, values.department, values.courseNumber || null, values.condition, values.description, userId, values.price, null, values.ISBN10 || null, values.ISBN13 || null, () => {
                        res.redirect(`/book/${req.params.bookId}`);
                    });
                });
            }
        } else {
            services.DepartmentService.getDepartments((departments) => {
                services.ConditionService.getConditions((conditions) => {
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
