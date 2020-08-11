import { Router } from 'express';
import { Request, Response, NextFunction, smallerImageURL } from './util';
import * as services from '../services';
import proxy from '../proxy';

export var router = Router();

// Get a book's image
router.get('/book/:bookId', (req: Request, res: Response, next: NextFunction) => {
    services.BookService.getBookInfo(req.params.bookId, (bookInfo) => {
        if (bookInfo) {
            if (bookInfo.imageurl) {
                proxy(res, smallerImageURL(bookInfo.imageurl), 'GET', (err) => {
                    if (err) {
                        res.redirect('/img/favicon-gray.png');
                    }
                });
            } else {
                res.redirect('/img/favicon-gray.png');
            }
        } else {
            next(); // 404
        }
    });
});

// Get a user's image
router.get('/user/:userId', (req: Request, res: Response, next: NextFunction) => {
    services.UserService.getUserInfoByUserId(req.params.userId, (userInfo) => {
        if (userInfo) {
            if (userInfo.imageurl) {
                proxy(res, smallerImageURL(userInfo.imageurl), 'GET', (err) => {
                    if (err) {
                        res.redirect('/img/favicon-gray.png');
                    }
                });
            } else {
                res.redirect('/img/favicon-gray.png');
            }
        } else {
            next(); // 404
        }
    });
});
