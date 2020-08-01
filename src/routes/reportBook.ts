import { Router } from 'express';
import { Request, Response, auth } from './util';
import * as services from '../services';

export var router = Router();

// Report book event
router.post('/:bookId', auth, (req: Request, res: Response) => {
    services.AuthService.getAuthUser(req.session.sessionId, (userId) => {
        services.BookService.getBookInfo(req.params.bookId, (bookInfo) => {
            services.ReportService.userReportedBook(userId, bookInfo.id, (alreadyReported) => {
                services.ReportService.userReportedRecently(userId, (reportedRecently) => {
                    if (!alreadyReported && !reportedRecently) {
                        services.ReportService.reportBook(userId, bookInfo.id, (deleted) => {
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
