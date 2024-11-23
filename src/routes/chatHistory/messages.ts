import express from "express";
import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

router.use(express.json());

/*
部屋を立てる
@roomName 部屋名
@userId 作成者
*/

export const messagesRoute = () => {
  router.post("/room-create", async (req, res) => {
    const { roomName, userId } = req.body;
    const createRoom = await prisma.room.create({
      data: {
        roomName,
        userId,
      },
    });
    res.json({ createRoom });
  });

  router.post("/room-select", async (req, res) => {
    const { userId } = req.body;
    if (userId) {
      try {
        const roomSelect = await prisma.room.findMany({
          select: {
            id: true,
            roomName: true,
          },
          where: {
            userId: userId,
          },
        });
        //配列をjsonに変形する
        res.status(200).json(roomSelect);
      } catch (error) {
        console.error(error);
        res.send({ message: "ルーム一覧取得エラー" });
      }
    }
  });

  /*
部屋の一覧取得
配列が返ってくる
*/
  router.post("/room-select-langchain", async (req, res) => {
    const { userId } = req.body;
    if (userId) {
      try {
        const roomSelect = await prisma.room.findMany({
          select: {
            id: true,
            roomName: true,
          },
          where: {
            userId: userId,
          },
        });
        //配列をjsonに変形する
        res.status(200).json(roomSelect);
      } catch (error) {
        console.error(error);
        res.send({ message: "ルーム一覧取得エラー" });
      }
    }
  });

  /*
メッセージ投稿
prisma勉強のため遠回りなことをする。
*/
  router.post("/message-create", async (req, res) => {
    const { userId, roomName, sender, message, mode } = req.body;

    try {
      const roomId = await prisma.room.findFirst({
        where: {
          userId: userId,
          roomName: roomName,
        },
      });
      const _message = await prisma.message.create({
        data: {
          sender,
          message,
          mode,
          room: {
            connect: { id: roomId?.id },
          },
        },
      });
      res.json({ _message });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "メッセージの書き込みに失敗しました。" });
    }
  });

  /*
メッセージを取得
*/
  router.post("/message-select", async (req, res) => {
    const { roomId } = req.body;
    //   const roomId = parseInt(req.body.roomId);
    try {
      const messagesSelect = await prisma.message.findMany({
        where: { roomId: roomId },
      });
      res.status(200).json(messagesSelect);
    } catch (error) {
      console.error(error);
      res.send({ message: "メッセージ取得エラー" });
    }
  });

  return router;
};
