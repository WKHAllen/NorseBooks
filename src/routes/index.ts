import { Router } from "express";
import { renderPage, Request, Response } from "./util";
import * as services from "../services";

export var router = Router();

// Main page
router.get("/", (req: Request, res: Response) => {
  services.DepartmentService.getDepartments((departments) => {
    services.SearchSortService.getSearchSortOptions((searchSortOptions) => {
      if (
        !req.query.title &&
        !req.query.author &&
        !req.query.department &&
        !req.query.courseNumber &&
        !req.query.ISBN &&
        !req.query.sort
      ) {
        renderPage(req, res, "index", {
          departments: departments,
          sortOptions: searchSortOptions,
        });
      } else {
        renderPage(req, res, "index", {
          departments: departments,
          sortOptions: searchSortOptions,
          form: {
            title: req.query.title,
            author: req.query.author,
            department: req.query.department,
            courseNumber: req.query.courseNumber,
            ISBN: req.query.ISBN,
            sort: req.query.sort,
          },
        });
      }
    });
  });
});
