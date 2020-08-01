import { Router } from 'express';
import { renderPage, Request, Response } from './util';
import * as services from '../services';

export var router = Router();

// Login page
router.get('/', (req: Request, res: Response) => {
    renderPage(req, res, 'login', { title: 'Login' });
});

// Login event
router.post('/', (req: Request, res: Response) => {
    services.LoginRegisterService.validLogin(req.body.email.replace('@luther.edu', ''), req.body.password, (valid, sessionId) => {
        if (valid) {
            req.session.sessionId = sessionId;
            if (req.query.after)
                res.redirect(req.query.after as string);
            else
                res.redirect('/');
        } else {
            renderPage(req, res, 'login', { title: 'Login', error: 'Invalid login' });
        }
    });
});
