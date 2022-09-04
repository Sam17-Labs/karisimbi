import { useEffect, useState } from "react";
import { useRouter } from 'next/router'
import axios from "axios";
import { curve } from '@futuretense/curve25519-elliptic';
import { PRE } from "@futuretense/proxy-reencryption";
//import {fileTypeFromBuffer} from 'file-type';

const BUCKET_URL = "https://karisimbi-s3-files.s3.amazonaws.com/";

export default function Upload() {
  const [file, setFile] = useState();
  const [uploadingStatus, setUploadingStatus] = useState();
  const [uploadedFile, setUploadedFile] = useState();
  const [keys, setKeys] = useState();
  const router = useRouter();

  const selectFile = async(e) => {
    console.log(await e.target.files[0].arrayBuffer());

    setFile(e.target.files[0]);
  };

  const uploadFile = async () => {
    // Encrypting the file
    const pre = new PRE(keys.privateKey.toBuffer(), curve);
    const tag = Buffer.from('TAG');
    const fileBuffer = await file.arrayBuffer();
    const cipherFile = await pre.selfEncrypt(fileBuffer, tag);
    
    setUploadingStatus("Uploading the file to AWS S3");

    let { data } = await axios.post("/api/s3/uploadFile", {
      name: file.name,
    });

    const url = data.url;
    await axios.put(url, cipherFile.data, {
      headers: {
        "Content-type": file.type,
        "Access-Control-Allow-Origin": "*",
      },
    });

    const plainFile = await pre.selfDecrypt(cipherFile);
    //console.log(await fileTypeFromBuffer(plainFile));
    setUploadingStatus("Finished uploading!");
    setUploadedFile(BUCKET_URL + file.name);
    setFile(null);
  };

  useEffect(() => {
    if(window != undefined){
      const privateKeyBuffer = window.localStorage.getItem("privateKey");
      if(privateKeyBuffer && !keys){
        const privateKey = curve.scalarFromBuffer(privateKeyBuffer);
        const publicKey = curve.basepoint.mul(privateKey).toBuffer();
        setKeys({publicKey, privateKey});
      } else if (!privateKeyBuffer){
        router.push('/account');
      }
    }
  });

  return (
    <div className="container flex items-center p-4 mx-auto min-h-screen justify-center">
      <main>
        <p>Please select a file to upload</p>
        <input type="file" onChange={(e) => selectFile(e)} />
        {file && (
          <>
            <p>Selected file: {file.name}</p>
            <button
              onClick={uploadFile}
              className=" bg-purple-500 text-white p-2 rounded-sm shadow-md hover:bg-purple-700 transition-all"
            >
              Upload a File!
            </button>
          </>
        )}
        {uploadingStatus && <p>{uploadingStatus}</p>}
        {uploadedFile && <img src={uploadedFile} />}
      </main>
    </div>
  );
}