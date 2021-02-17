import { Router } from "express";
import { Request, Response } from "./util";
import * as services from "../services";

export var router = Router();

// Get the current alert
router.get("/", (req: Request, res: Response) => {
  services.MetaService.getMeta("Alert timeout", (alertTimeout) => {
    if (Math.floor(parseInt(alertTimeout) - new Date().getTime() / 1000) > 0) {
      services.MetaService.getMeta("Alert", (alertValue) => {
        res.json({ alertValue: alertValue });
      });
    } else {
      res.json({});
    }
  });
});
