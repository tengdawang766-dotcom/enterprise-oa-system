import { Router, Request, Response, NextFunction } from 'express';
import { departmentService } from './department.service';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  departmentQuerySchema,
  setManagerSchema,
  managerCandidateQuerySchema,
} from './dto/department.dto';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../common/response/api-response';

export const departmentRouter = Router();

// Create department
departmentRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = createDepartmentSchema.parse(req.body);
    const result = await departmentService.create(dto);
    sendCreated(res, result);
  } catch (err) {
    next(err);
  }
});

// List departments
departmentRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = departmentQuerySchema.parse(req.query);
    const result = await departmentService.findAll(query);
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});

// Department detail
departmentRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const result = await departmentService.findById(id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// Update department name
departmentRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const dto = updateDepartmentSchema.parse(req.body);
    const result = await departmentService.update(id, dto);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// Delete department
departmentRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    await departmentService.remove(id);
    sendNoContent(res);
  } catch (err) {
    next(err);
  }
});

// ========================
// Manager Management
// ========================

// Get manager candidates
departmentRouter.get('/:id/manager-candidates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const departmentId = Number(req.params.id);
    const query = managerCandidateQuerySchema.parse(req.query);
    const result = await departmentService.getManagerCandidates(departmentId, query);
    sendPaginated(res, result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    next(err);
  }
});

// Set/replace manager (PUT)
departmentRouter.put('/:id/manager', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const departmentId = Number(req.params.id);
    const dto = setManagerSchema.parse(req.body);
    const result = await departmentService.setManager(departmentId, dto);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// Remove manager (DELETE)
departmentRouter.delete('/:id/manager', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const departmentId = Number(req.params.id);
    const result = await departmentService.removeManager(departmentId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});
