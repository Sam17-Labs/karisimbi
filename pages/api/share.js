import client from '../utility/apolloClient';
import { gql, useMutation, useQuery } from "@apollo/client";


export default async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }
  
    try {
      let { file,
        reEncryptionKey,
        shareAddress: shareAddressBuffer } = req.body;
  
      const fileParams = {
        Bucket: process.env.BUCKET_NAME,
        Key: name,
        Expires: 600,
        ContentType: type,
      };
  
      const url = await s3.getSignedUrlPromise("putObject", fileParams);
  
      res.status(200).json({ url });
    } catch (err) {
      console.log(err);
      res.status(400).json({ message: err });
    }
  };