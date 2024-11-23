import "dotenv/config";

import express from "express";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

const router = express.Router();
/*
Hypothetical Document Embeddingsが試せるAPI
*/
const embedder = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
  apiKey: process.env.OPENAI_KEY,
});
const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_KEY,
  model: "gpt-4o",
  temperature: 0,
});

//data store
const pinecone = new PineconeClient();
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);
const vectorStore = new PineconeStore(embedder, {
  pineconeIndex: pineconeIndex,
  namespace: "qa",
});
const retriever = vectorStore.asRetriever();

export const hydeSearchRouter = () => {
  router.post("/hyde_search", async (req, res) => {
    const q = req.body.query;

    try {
      //使用するプロンプト
      const prompt = ChatPromptTemplate.fromTemplate(`
        貴方は仙台市のごみの捨て方についてのアシスタントです。以下の要件を守って回答してください。
        ###
        ・提示された関連情報にだけ基づいてユーザーの問い合わせに回答してください。
        ・ゴミの捨て方に関係のない問い合わせには答えず、捨て方にだけ回答をしてください。
        ・参考にした情報を参照できるように回答の後ろに付け加えてください。
        ・与えられた関連情報が回答に十分ではない場合は「わかりません」とだけ答えてください。
        ###
        ユーザーの問い合わせ：{question}
        
        関連情報：
        {context}
      `);

      //質問を受け取り回答を予想する
      const hyp_promopt = ChatPromptTemplate.fromTemplate(`
        以下の質問に回答する一文を考えてください。

        質問：{question}
        
        `);

      const chain = hyp_promopt.pipe(llm).pipe(new StringOutputParser());
      const hyp_rag_chain = RunnableSequence.from([
        {
          context: chain.pipe(retriever),
          question: new RunnablePassthrough(),
        },
        prompt,
        llm,
        new StringOutputParser(),
      ]);

      const message = await hyp_rag_chain.invoke({
        question: q,
      });

      res.status(200).send({ message: message });
    } catch (error) {
      res.status(500).send({ message: "query does not match any search" });
    }
  });
  return router;
};
