import "dotenv/config";

import express from "express";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";

const router = express.Router();

/*
通常のベクトル検索用API
*/

//埋め込みモデル
const embedder = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
  apiKey: process.env.OPENAI_KEY,
});
//チャットモデル
const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_KEY,
  model: "gpt-4o",
  temperature: 0,
});

//vector store
const pinecone = new PineconeClient();
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);
const pineconeStore = new PineconeStore(embedder, {
  pineconeIndex: pineconeIndex,
  namespace: "qa",
});

export const pineconeRouter = () => {
  router.post("/pinecone-sample", async (req, res) => {
    const q = req.body.query;

    try {
      //質問を受け取り、関連するデータを取得する
      const data = await pineconeStore.similaritySearch(q, 10);
      //! 後で取得の成功を判断する処理を書く
      const relatedDocs = data.map(
        (doc) => doc.pageContent || doc.metadata.source
      );

      const prompt = `
      貴方は仙台市のごみの捨て方についてのアシスタントです。以下の要件を守って回答してください。
      ・提示された関連情報にだけ基づいてユーザーの問い合わせに回答してください。
      ・ゴミの捨て方に関係のない問い合わせには答えず、捨て方にだけ回答をしてください。
      ・参考にした質問を回答の後ろに参照できるように付け加えてください。
      ・関連情報は"""[質問]質問内容[回答]回答内容"""で与えられます。情報が見つからないと思う場合は関連情報から推論して回答し、推論元の関連情報を提示してください。

      ユーザーの問い合わせ：
      ${q}
      
      関連情報：
      ${relatedDocs.join("\n")}
      `;

      const completion = await llm.invoke(prompt);

      // res.status(200).send([...data]);
      res.status(200).send({ message: completion.content });
    } catch (error) {
      res.status(500).send({ message: "query does not match any search" });
    }
  });
  return router;
};
