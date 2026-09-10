import { Router, Request, Response, NextFunction } from 'express';
import { directoryService } from './directory.service';
import { directoryQuerySchema } from './dto/directory.dto';
import { sendSuccess, sendPaginated } from '../../common/response/api-response';


import { parseIdParam } from '../../common/utils/parse-id';

export const directoryRouter = Router();

// ========================
// Directory List
// ========================
directoryRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = directoryQuerySchema.parse(req.query);
    const result = await directoryService.findAll(query);
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});

// ========================
// Department list for filter
// ========================
directoryRouter.get('/departments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await directoryService.getDepartments();
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ========================
// Directory Detail
// ========================
directoryRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseIdParam(req.params.id);
    const result = await directoryService.findById(id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});
