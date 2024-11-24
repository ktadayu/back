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
import { DynamicTool } from "langchain/tools";
import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { GoogleCustomSearch } from "@langchain/community/tools/google_custom_search";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { createRetrieverTool } from "langchain/tools/retriever";

const router = express.Router();

/*
適切な回答がない場合にインターネット検索を行う
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

const tavily_search = new TavilySearchResults({
  maxResults: 2,
});

const addTool = new DynamicTool({
  name: "add",
  description: "calculate the sum of numbers",
  func: async (a, b) => (a + b).toString(),
});

// const search = new DynamicTool({
//   name: "search",
//   description: "search how to disposal and return related docs",
//   func: async (query) => {
//     return pineconeStore.similaritySearch(query, 5);
//   },
// });

const retrieverTool = createRetrieverTool(retriever, {
  name: "search",
  description: "search how to disposal and return related docs",
});

const tools = [tavily_search, addTool, retrieverTool];

const serachRouter = async () => {
  const prompt = ChatPromptTemplate.fromTemplate(`
      貴方は仙台市のごみの捨て方についてのアシスタントです。以下の要件を守って回答してください。
      ###
      ・ゴミの捨て方に関係のない問い合わせには答えず、捨て方にだけ回答をしてください。
      ・参考にした情報を参照できるように回答の後ろに付け加えてください。
      ・与えられた関連情報が回答に十分ではない場合はインターネット検索を用いて答えてください。
      ###
      ユーザーの問い合わせ：{question}

      思考:{agent_scratchpad}
    `);

  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });

  const result1 = await agentExecutor.invoke({
    question: "レコード盤の出し方",
  });

  console.log(result1);
};

serachRouter();

//(中間プロンプト)
// 貴方は仙台市のごみの捨て方についてのアシスタントです。以下の要件を守って回答してください。
//       ###
//       ・ゴミの捨て方に関係のない問い合わせには答えず、捨て方にだけ回答をしてください。
//       ・参考にした情報を参照できるように回答の後ろに付け加えてください。
//       ・与えられた関連情報が回答に十分ではない場合はインターネット検索を用いて答えてください。
//       ###
//       ユーザーの問い合わせ：レコード盤の出し方

//       思考:[{"lc":1,"type":"constructor","id":["langchain_core","messages","AIMessageChunk"],
// "kwargs":{"content":"","additional_kwargs":{"function_call":{"name":"search","arguments":"{\"query\":\"仙台市 レコード盤 ゴミの捨て方\"}"}},
//"response_metadata":{"prompt":0,"completion":0,"usage":{"prompt_tokens":267,"completion_tokens":25,"total_tokens":292,"prompt_tokens_details":
//{"cached_tokens":0,"audio_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"audio_tokens":0,"accepted_prediction_tokens":0,"rejected_prediction_tokens":0}},
//"finish_reason":"function_call","system_fingerprint":"fp_7f6be3efb0"},"tool_call_chunks":[],"id":"chatcmpl-AXCsBXrVlhjzmyxvEGahgV0Dgd97B",
//"usage_metadata":{"input_tokens":267,"output_tokens":25,"total_tokens":292,"input_token_details":{"audio":0,"cache_read":0},"output_token_details":{"audio":0,"reasoning":0}},"tool_calls":[],
//"invalid_tool_calls":[]}},{"lc":1,"type":"constructor","id":["langchain_core","messages","FunctionMessage"],
//"kwargs":{"content":"[質問]レコード盤の出し方を教えてください。[回答]プラスチック資源指定袋に入れて指定曜日にごみ集積所に出してください。\n\n[質問]収集後にごみが残っている場合は、どうしたらよいですか。[回答]分別不良のものや収集できないものが混入している場合は、警告シールを貼付し、取り残す場合があります。警告シールが貼付されていない場合は、環境局資源循環企画課またはお住まいの区の環境事業所にお問い合わせください。≪関連ホームページ≫環境事業所\n\n[質問]CD・DVD・BDのごみの出し方を教えてください。[回答]CD・DVD・BDは、プラスチック資源指定袋に入れて指定曜日にごみ集積所に出してください。\n\n[質問]家電4品目(テレビ、エアコン、冷蔵庫・冷凍庫、洗濯機・乾燥機)の出し方を教えてください。[回答]家電リサイクル法の対象品目の処分方法は、「自分で指定引取場所へ運ぶ方法」と「引き取りを依頼する方法」があります。必要な費用は、家電リサイクル法の対象品目ごとの「リサイクル料金」のほか、引き取りを依頼する場合は別途「収集運搬料金」がかかります。◆「自分で指定引取場所へ運ぶ方法」で処分する場合【指定引取場所(2か所)】・(株)庄子専助商店　宮城野区日の出町2-5-30　電話番号:022-346-9055・東北トラック(株)宮城野取扱所　宮城野区苦竹4-3-1　電話番号:022-231-7567受付時間：月曜日～土曜日　午前9時から正午まで、午後1時から午後5時まで(祝休日、お盆、年末年始などはお休み)①指定引取場所へ搬入する前に郵便局に備え付けの「家電リサイクル券」に必要事項を記入して、リサイクル料を振り込んでください。リサイクル料金や郵便局での振込方法等については、家電リサイクルセンター(電話番号:0120-31-9640　午前9時から午後6時まで。日曜・祝日除く)に問い合わせるか、郵便局の備え付けの冊子でご確認ください。メーカー名(テレビ、冷蔵庫・冷凍庫の場合は型式〔容積〕も)が必要となりますので、事前に確認してください。②処分する家電と家電リサイクル券を持参して、指定引取場所へ持ち込んでください。◆「引き取りを依頼する方法」で処分する場合家電量販店または本市の地域ごとに決められた許可業者へ依頼してください。必要な費用は家電リサイクル法の対象品目ごとの「リサイクル料金」の他、別途「収集運搬料金」がかかります。引き取り、支払いの方法、収集運搬料金は、依頼先により異なります。詳しくは依頼先にお問い合せください。【地域ごとの許可業者】青葉区(宮城総合支所管内を除く、おおむね南町通・新寺通より北側の地域 )：(協)仙台清掃公社　電話番号:022-236-6543青葉区(宮城総合支所管内を除く、おおむね南町通・新寺通より南側の地域 )：(株)公害処理センター　電話番号:022-289-6111宮城野区・若林区(おおむね南町通・新寺通より北側の地域：(協)仙台清掃公社　電話番号:022-236-6543若林区(おおむね南町通・新寺通より南側の地域)・太白区(秋保総合支所管内を除く)：(株)公害処理センター　電話番号:022-289-6111泉区：(株)泉 電話番号:022-376-4753宮城総合支所・秋保総合支所管内：(株)宮城衛生環境公社　電話番号:022-393-2216≪関連ホームページ≫(一社)家電製品協会 家電リサイクル券センターホームページ市で収集しないものの相談先(家電4品目)","name":"search","additional_kwargs":{},"response_metadata":{}}}]
