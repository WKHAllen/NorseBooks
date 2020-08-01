import { Router } from 'express';
import { Request, Response } from './util';
import * as services from '../services';

export var router = Router();

// Logout event
router.get('/', (req: Request, res: Response) => {
    services.SessionService.deleteSession(req.session.sessionId, () => {
        req.session.destroy(() => {
            res.redirect('/login');
        });
    });
});
