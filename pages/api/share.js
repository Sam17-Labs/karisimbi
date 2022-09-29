/* eslint-disable import/no-anonymous-default-export */
import { graphqlClient } from "../../utility/client";
import { gql } from "graphql-request";
import axios from "axios";
import { PRE } from "@futuretense/proxy-reencryption";
import { curve } from '@futuretense/curve25519-elliptic';

import S3 from "aws-sdk/clients/s3";
import { randomBytes, randomUUID } from "crypto";

const s3 = new S3({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  signatureVersion: "v4",
});

export default async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }
    let { file, reEncryptionKey, shareAddress } = req.body;
    console.log(file, reEncryptionKey, shareAddress);
    // Get the file from S3 
    const { data: cipherFile } = await axios({
      method: "GET",
      url: file.s3Url
    });

    shareAddress = Buffer.from(shareAddress.data);

    for (const attribute of Object.keys(cipherFile)) {
      const attributeDataArr = Buffer.from(cipherFile[attribute].data);
      cipherFile[attribute]= attributeDataArr;      
    }

    for (const attribute of Object.keys(reEncryptionKey)) {
      const attributeDataArr = Buffer.from(reEncryptionKey[attribute].data);
      reEncryptionKey[attribute]= attributeDataArr;      
    }
    
    const reEncryptedFile = PRE.reEncrypt(shareAddress, cipherFile, reEncryptionKey, curve);

    console.log(reEncryptedFile);

    // Store the new file in S3
    const fileParams = {
      Bucket: process.env.BUCKET_NAME,
      Key: randomUUID(),
      Expires: 600
    };

    const url = await s3.getSignedUrlPromise("putObject", fileParams);

    const response = await axios.put(url, reEncryptedFile, {
      headers: {
        "Content-type": "text/javascript",
        "Access-Control-Allow-Origin": "*",
      },
    });

    console.log(response);

    // Store the data in the db 
    const createFileMutation = gql`
    mutation createFileMutation($fileObject: File_insert_input = {}) {
      createOneFile(object: $fileObject) {
        id
        fileName
        fileMimeType
        owner
        s3Url
      }
    }
    `
  // console.log("client:", graphqlClient);
  // const data = await graphqlClient.request(createFileMutation, {
  //   fileName: file.fileName,
  //   fileMimeType: file.fileMimeType,
  //   owner: 
  // })
  // console.log(JSON.stringify(data, undefined, 2))
  res.status(200).json(JSON.stringify(data));
  };