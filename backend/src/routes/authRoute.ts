import express from "express";


import {
  signUpController,
  validateInviteCodeController,
} from "../controllers/authController";
import { signupRateLimitMiddleware } from "../middleware/signupRateLimitMiddleware";

const authRouter = express.Router();

authRouter.post(
  "/validate-invite",
  express.json(),
  validateInviteCodeController
);

authRouter.post(
  "/signup",
  express.json(),
  signupRateLimitMiddleware,
  signUpController,
);


export default authRouter;
