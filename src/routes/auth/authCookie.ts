import { Request, Response, Router } from "express";
import admin from "firebase-admin";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";

export const cookieRouter = () => {
  const router = Router();
  router.use(cookieParser());

  router.get("/auth-cookie", async (req, res) => {
    const idToken = req.cookies.idToken;
    if (!idToken) {
      res.status(401).send("Unauthorized");
    }
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      res.status(200).json({ userId });
    } catch (error) {
      console.error("Token verificatiuon failed", error);
      res.status(401).send("Unauthorized");
    }
  });
  return router;
};
