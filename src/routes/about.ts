import { Router } from 'express';
import { renderPage, Request, Response } from './util';

export var router = Router();

// About page
router.get('/', (req: Request, res: Response) => {
    renderPage(req, res, 'about', { title: 'About NorseBooks' });
});
