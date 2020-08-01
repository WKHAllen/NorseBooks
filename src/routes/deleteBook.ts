import { Router } from 'express';
import { Request, Response, auth } from './util';
import * as services from '../services';

export var router = Router();

// Delete book event
router.post('/:bookId', auth, (req: Request, res: Response) => {
    services.AuthService.getAuthUser(req.session.sessionId, (userId) => {
        services.BookService.getBookInfo(req.params.bookId, (bookInfo) => {
            services.BookService.deleteBook(userId, bookInfo.id, () => {
                res.redirect('/');
            });
        });
    });
});
