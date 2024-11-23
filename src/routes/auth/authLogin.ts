import admin from "firebase-admin";
import express from "express";
import { Router } from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";

const router = Router();
router.use(express.json());
router.use(bodyParser.json());
router.use(cookieParser());

export const loginRouter = () => {
  router.post("/auth-login", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      let idToken;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        idToken = authHeader.substring(7, authHeader.length);
      } else {
        console.log("authHeader:", authHeader);
        res.status(401).send("トークンが提供されていません");
      }

      const decodedToken = await admin.auth().verifyIdToken(idToken as string);
      const userId = decodedToken.uid;

      console.log(`${userId}がログインしました`);
      res.status(200).send({ message: "Login Successful" });
    } catch (error) {
      console.error("Token verification failed", error);
      res.status(401).send("Unauthorized");
    }
  });

  return router;
};
