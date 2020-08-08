import { Router } from 'express';
import { Request, Response, NextFunction, smallerImageURL } from './util';
import * as services from '../services';
import { proxy } from '../proxy';

export var router = Router();

// Get a book's image
router.get('/book/:bookId', (req: Request, res: Response, next: NextFunction) => {
    services.BookService.getBookInfo(req.params.bookId, (bookInfo) => {
        if (bookInfo) {
            proxy(res, smallerImageURL(bookInfo.imageurl));
        } else {
            next(); // 404
        }
    });
});

// Get a user's image
router.get('/user/:userId', (req: Request, res: Response, next: NextFunction) => {
    services.UserService.getUserInfoByUserId(req.params.userId, (userInfo) => {
        if (userInfo) {
            proxy(res, smallerImageURL(userInfo.imageurl));
        } else {
            next(); // 404
        }
    });
});
