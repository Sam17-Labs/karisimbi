import { useEffect, useState } from "react";
import { useRouter } from 'next/router';
import axios from "axios";
import { curve } from '@futuretense/curve25519-elliptic';
import { PRE } from "@futuretense/proxy-reencryption";
import { gql, useMutation, useQuery } from "@apollo/client";


const BUCKET_URL = "https://karisimbi-s3-files.s3.amazonaws.com/";

export default function Upload() {
  const [file, setFile] = useState();
  const [uploadingStatus, setUploadingStatus] = useState();
  const [keys, setKeys] = useState();
  const [user, setUser] = useState();
  const router = useRouter();

  const selectFile = async(e) => {
    setFile(e.target.files[0]);
  };

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
  const [createOneFile, { data, loading, error }] = useMutation(createFileMutation);

  const getUserByPublicKeyQuery = gql`
    query getUserByPublicKey($publicKey: String = "") {
      users(where: {publicKey: {_eq: $publicKey}}) {
        id
        publicKey
        username
      }
    }  
  `

  const { data: usersQueryData, 
    loading: usersQueryLoading, 
    error:UsersQueryError } = useQuery(getUserByPublicKeyQuery, {
      variables: {
        publicKey: (keys) ? Buffer.from(keys?.publicKey).toString("base64") : ""
      }
    });

  const uploadFile = async () => {
    // Encrypting the file
    const pre = new PRE(keys.privateKey.toBuffer(), curve);
    const tag = Buffer.from('TAG');
    const fileBuffer = await file.arrayBuffer();
    const cipherFile = await pre.selfEncrypt(fileBuffer, tag);

    setUploadingStatus("Uploading the file to AWS S3");

    const { data: { url } } = await axios.post("/api/s3/uploadFile", {
      name: file.name,
    });

    await axios.put(url, cipherFile, {
      headers: {
        "Content-type": "text/javascript",
        "Access-Control-Allow-Origin": "*",
      },
    });

    console.log(cipherFile);
    const plainFile = await pre.selfDecrypt(cipherFile);
    const blob = new Blob([plainFile], { type: file.type });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = file.name || Math.random();
    a.href = blobUrl;
    a.click();
    URL.revokeObjectURL(blob);
    createOneFile({
      variables: {
        fileObject: {
          fileMimeType: file.type, 
          fileName: file.name,
          owner: user.id, 
          s3Url: BUCKET_URL + file.name
        }
      }
    })
    setUploadingStatus("Finished uploading!");
    setFile(null);
  };

  useEffect(() => {
    if(usersQueryData){
      setUser(usersQueryData.users[0]);
    }
  }, [usersQueryData]);

  useEffect(() => {
    // Fetch the file
    if(window != undefined){
      const privateKeyBase64= window.localStorage.getItem("privateKey");
      if(privateKeyBase64 && !keys){
        const privateKey = curve.scalarFromBuffer(Buffer.from(privateKeyBase64, "base64"));
        const publicKey = curve.basepoint.mul(privateKey).toBuffer();
        setKeys({publicKey, privateKey});
      } else if (!privateKeyBase64){
        router.push('/account');
      }
    }
  }, [keys, router]);

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
      </main>
    </div>
  );
}