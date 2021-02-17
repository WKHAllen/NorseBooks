import { Router } from "express";
import {
  Request,
  Response,
  stripWhitespace,
  minISBN,
  validISBN,
} from "./util";
import * as services from "../services";

export var router = Router();

interface BookSearchOptions {
  title?: string;
  author?: string;
  departmentId?: number;
  courseNumber?: number;
  ISBN?: string;
}

// Get more books to populate the index page
router.get("/", (req: Request, res: Response) => {
  services.BookService.validBook(req.query.lastBook as string, (exists) => {
    if (exists || !req.query.lastBook) {
      // title
      var title = stripWhitespace(req.query.title as string);
      // author
      var author = stripWhitespace(req.query.author as string);
      // department
      var department = parseInt(
        stripWhitespace(req.query.department as string)
      );
      if (isNaN(department)) department = null;
      // course number
      var courseNumber = parseInt(
        stripWhitespace(req.query.courseNumber as string)
      );
      // ISBN
      var ISBN = minISBN(
        stripWhitespace(req.query.ISBN as string).toUpperCase()
      );
      // sort
      var sort = parseInt(stripWhitespace(req.query.sort as string));
      if (isNaN(sort)) sort = null;
      var searchOptions: BookSearchOptions = {};
      // Check title
      if (title.length > 0 && title.length <= 128) searchOptions.title = title;
      // Check author
      if (author.length > 0 && author.length <= 64)
        searchOptions.author = author;
      // Check department
      services.DepartmentService.validDepartment(department, (valid) => {
        if (valid) searchOptions.departmentId = department;
        // Check course number
        if (!isNaN(courseNumber) && courseNumber >= 101 && courseNumber <= 499)
          searchOptions.courseNumber = courseNumber;
        // Check ISBN
        if (validISBN(ISBN)) searchOptions.ISBN = ISBN;
        // Check sort
        services.SearchSortService.validSearchSortOption(sort, (valid) => {
          if (!valid) sort = null;
          // Perform search
          services.BookService.searchBooks(
            searchOptions,
            sort,
            req.query.lastBook as string,
            (rows) => {
              res.json({ books: rows });
            }
          );
        });
      });
    } else {
      res.json({ err: "Last book does not exist" });
    }
  });
});
