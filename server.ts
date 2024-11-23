import express from "express";
import cors from "cors";
import { cookieRouter } from "./src/routes/auth/authCookie.js";
import { loginRouter } from "./src/routes/auth/authLogin.js";
import admin from "firebase-admin";
import serviceAccount from "./re-chatapp-2658d-firebase-adminsdk-y7g3f-177ea7126d.json";
import { ServiceAccount } from "firebase-admin";
import { messagesRoute } from "./src/routes/chatHistory/messages.js";
import { pineconeRouter } from "./src/routes/withPinecone/pinecone.js";
import { multiQueryRouter } from "./src/routes/withPinecone/keywordExt.js";
import { hydeSearchRouter } from "./src/routes/withPinecone/hypo.js";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as ServiceAccount),
});

const app = express();
const corsOptions = {
  origin: "http://localhost:3000",
  credentials: true,
};
const port = 5000;

// const openaiRoute = require("./routers/openai/openai");
// const neo4jRoute = require("./routers/neo4j/searchRecentNews");

app.use(express.json());
app.use(cors(corsOptions));

//ログイン用api
app.use("/", cookieRouter());
app.use("/", loginRouter());

//messageAPIに繋ぐ
app.use("/", messagesRoute());

// app.use("/", openaiRoute);

//vector検索
app.use("/", pineconeRouter());
app.use("/", multiQueryRouter());
app.use("/", hydeSearchRouter());

// app.use("/", neo4jRoute);

app.listen(port, () => console.log(`server is runnning on PORT ${port}`));
