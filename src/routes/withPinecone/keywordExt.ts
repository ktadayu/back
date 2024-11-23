import "dotenv/config";

import express from "express";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import { pull } from "langchain/hub";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

const router = express.Router();

/*
複数の検索キーワードを生成しそれぞれで問い合わせを行うAPI
*/

const embedder = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
  apiKey: process.env.OPENAI_KEY,
});

const pinecone = new PineconeClient();
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);
const pineconeStore = new PineconeStore(embedder, {
  pineconeIndex: pineconeIndex,
  namespace: "qa",
});
const retriever = pineconeStore.asRetriever();

const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_KEY,
  model: "gpt-4o",
  temperature: 0,
});

export const multiQueryRouter = () => {
  router.post("/multi_query", async (req, res) => {
    const q = req.body.query;

    //使用するプロンプト
    const prompt = ChatPromptTemplate.fromTemplate(`
        貴方は仙台市のごみの捨て方についてのアシスタントです。以下の要件を守って回答してください。
      ・提示された関連情報にだけ基づいてユーザーの問い合わせに回答してください。
      ・ゴミの捨て方に関係のない問い合わせには答えず、捨て方にだけ回答をしてください。
      ・参考にした質問を回答の後ろに参照できるように付け加えてください。
      ・関連情報は"""[質問]質問内容[回答]回答内容"""で与えられます。情報が見つからないと思う場合は関連情報から推論して回答し、推論元の関連情報を提示してください。

      ユーザーの問い合わせ：{question}
      
      関連情報：
      {context}
      `);

    //検索クエリとは異なるキーワードの生成
    const q_gene_promopt = ChatPromptTemplate.fromTemplate(`
    以下の質問に対して、ベクトルDBを検索するために有用なキーワードを3つ回答してください。

    質問：{question}
    
    `);
    const multiQueries = z.object({
      queries: z.array(z.string()),
    });
    const queryGenChain = q_gene_promopt
      .pipe(llm.withStructuredOutput(multiQueries))
      .pipe((x) => x.queries);
    const multiQueryChain = RunnableSequence.from([
      {
        question: new RunnablePassthrough(),
        context: queryGenChain.pipe(retriever.map()),
      },
      prompt,
      llm,
      new StringOutputParser(),
    ]);

    const message = await multiQueryChain.invoke({
      question: q,
    });
    res.status(200).send({ message: message });
  });
  return router;
};
