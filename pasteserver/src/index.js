import { config } from "dotenv";
config();

import { createHash } from "crypto";
import express from "express";
import { S3, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import bodyParser from "body-parser";
import cors from "cors";

/**
 * @param {Buffer} data 
 * @returns {string}
 */
function shaHash(data) {
    return createHash("sha256").update(data).digest("hex");
}

const client = new S3({
    forcePathStyle: false,
    endpoint: "https://nyc3.digitaloceanspaces.com",
    region: "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

const app = express();

app.use(bodyParser.raw());

app.use(cors());

app.all("/", (req, res) => {
    res.status(200).end("See possible routes @ https://github.com/zigtools/playground under pasteserver");
});

// list out pastes that match hash
app.get("/list/:hash", async (req, res) => {
    if (req.params.hash.length !== 6) {
        return res.status(400).end("must be first 6 chars of hash (read as: 6 hex chars)");
    }

    const out = await client.send(new ListObjectsV2Command({
        Bucket: "zig-playground-pastes",
        Prefix: req.params.hash,
    }));

    if (!out.Contents) {
        return res.status(200).json([]);
    }

    res.status(200).json(out.Contents.map(_ => _.Key));
});

app.get("/get/:hash", async (req, res) => {
    if (req.params.hash.length !== 6) {
        return res.status(400).end("must be first 6 chars of hash (read as: 6 hex chars)");
    }

    const listOut = await client.send(new ListObjectsV2Command({
        Bucket: "zig-playground-pastes",
        Prefix: req.params.hash,
    }));

    if (!listOut.Contents) {
        return res.status(404).json("paste not found");
    }

    if (listOut.Contents.length !== 1) {
        return res.status(409).json("collision!");
    }

    const out = await client.send(new GetObjectCommand({
        Bucket: "zig-playground-pastes",
        Key: listOut.Contents[0].Key,
    }));

    if (!out.Body) {
        return res.status(404).end("paste not found");
    }

    res.status(200);
    out.Body.pipe(res);
});

// get from exact hash
app.get("/getExact/:hash", async (req, res) => {
    if (req.params.hash.length !== 64) {
        return res.status(400).end("hash must be 256 bits (read as: 64 hex chars)");
    }

    const out = await client.send(new GetObjectCommand({
        Bucket: "zig-playground-pastes",
        Key: req.params.hash,
    }));

    if (!out.Body) {
        return res.status(404).end("paste not found");
    }

    res.status(200);
    out.Body.pipe(res);
});

app.put("/put", async (req, res) => {
    if (!Buffer.isBuffer(req.body)) {
        return res.status(400).end("body must be a buffer (hint: Content-Type should be application/octet-stream)");
    }

    const hash = shaHash(req.body);
    await client.send(new PutObjectCommand({
        Bucket: "zig-playground-pastes",
        Key: hash,
        Body: req.body,
    }));

    return res.status(200).end(hash);
});

app.listen(3000, "127.0.0.1");
