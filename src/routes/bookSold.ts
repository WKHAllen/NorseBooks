import { Router } from "express";
import {
  Request,
  Response,
  auth,
  imagePublicId,
  logCloudinaryDestroyError,
  cloudinaryName,
  cloudinaryApiKey,
  cloudinaryApiSecret,
} from "./util";
import * as services from "../services";
import * as cloudinary from "cloudinary";

cloudinary.v2.config({
  cloud_name: cloudinaryName,
  api_key: cloudinaryApiKey,
  api_secret: cloudinaryApiSecret,
});

export var router = Router();

// Book sold event
router.post("/:bookId", auth, (req: Request, res: Response) => {
  services.AuthService.getAuthUser(
    (req.session as any).sessionId,
    (userId) => {
      services.BookService.getBookInfo(req.params.bookId, (bookInfo) => {
        services.BookService.bookSold(userId, bookInfo.id, () => {
          cloudinary.v2.uploader.destroy(
            imagePublicId(bookInfo.imageurl),
            (err, result) => {
              logCloudinaryDestroyError(bookInfo.imageurl, err, result);
              res.redirect("/");
            }
          );
        });
      });
    }
  );
});
