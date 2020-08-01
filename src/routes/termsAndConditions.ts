import { Router } from 'express';
import { renderPage, Request, Response } from './util';
import * as services from '../services';
import * as showdown from 'showdown';

var converter = new showdown.Converter();

export var router = Router();

// Terms and conditions page
router.get('/', (req: Request, res: Response) => {
    services.MetaService.getMeta('Terms and Conditions', (termsAndConditions) => {
        termsAndConditions = converter.makeHtml(termsAndConditions);
        renderPage(req, res, 'terms-and-conditions', {
            title: 'Terms and conditions',
            termsAndConditions: termsAndConditions
        });
    });
});
