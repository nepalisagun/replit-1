import { Router, type IRouter } from "express";
import healthRouter from "./health";
import geminiRouter from "./gemini";
import memoriesRouter from "./memories";
import documentsRouter from "./documents";
import eventsRouter from "./events";
import statsRouter from "./stats";
import reflectRouter from "./reflect";

const router: IRouter = Router();

router.use(healthRouter);
router.use(geminiRouter);
router.use(memoriesRouter);
router.use(documentsRouter);
router.use(eventsRouter);
router.use(statsRouter);
router.use(reflectRouter);

export default router;
