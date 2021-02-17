import { Router } from "express";
import { renderPage, Request, Response } from "./util";
import * as services from "../services";

export var router = Router();

// User info page
router.get("/:userId", (req: Request, res: Response) => {
  services.UserService.validUser(req.params.userId, (valid) => {
    if (valid) {
      services.UserService.getUserInfoByUserId(
        req.params.userId,
        (userInfo) => {
          services.UserService.getUserBooks(userInfo.id, (booksListed) => {
            renderPage(req, res, "user", {
              title: `${userInfo.firstname} ${userInfo.lastname}`,
              firstname: userInfo.firstname,
              lastname: userInfo.lastname,
              profileUserId: req.params.userId,
              joinTimestamp: userInfo.jointimestamp,
              itemsSold: userInfo.itemssold,
              booksListed: booksListed,
              hasListings: booksListed.length > 0,
            });
          });
        }
      );
    } else {
      renderPage(req, res, "user-not-found", { title: "User not found" });
    }
  });
});
