import { Router } from 'express';
import { Request, Response, NextFunction, smallerImageURL } from './util';
import * as services from '../services';
import { proxy } from '../proxy';

export var router = Router();

// Get a book's image
router.get('/book/:bookId', (req: Request, res: Response, next: NextFunction) => {
    services.BookService.getBookInfo(req.params.bookId, (bookInfo) => {
        if (bookInfo) {
            proxy(req, res, smallerImageURL(bookInfo.imageurl));
        } else {
            // 404
            next();
        }
    });
});
