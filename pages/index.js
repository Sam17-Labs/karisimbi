import Head from 'next/head';
import { useEffect, useState } from 'react';
import axios from "axios";
import { gql, useMutation, useQuery } from "@apollo/client";
import { curve } from '@futuretense/curve25519-elliptic';
import { PRE } from "@futuretense/proxy-reencryption";
import { useRouter } from 'next/router';
import Image from 'next/image';

let pre;
const BUCKET_URL = "https://karisimbi-s3-files.s3.amazonaws.com/";

export default function Home() {
  const router = useRouter();

  const [keys, setKeys] = useState();
  const [user, setUser] = useState();
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState();
  const [uploadedFile, setUploadedFile] = useState();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState();
  const [shareAddress, setShareAddress] = useState();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadingStatus, setUploadingStatus] = useState();
  const [searchKeyword, setSearchKeyword] = useState();
  const [isAccountDetailModalOpen, setIsAccountDetailModelOpen] = useState(false);

  if (keys) {
    pre = new PRE(keys.privateKey.toBuffer(), curve);
  }

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
  
  const getFilesById = gql`
    query getfilesById($owner: uuid = "") {
      files(where: {owner: {_eq: $owner}}) {
        createdAt
        fileMimeType
        description
        fileName
        id
        owner
        s3Url
        shared
        updatedAt
      }
    }`
  
  const { data: filesQueryData, 
    loading: filesQueryLoading, 
    error: filesQueryError } = useQuery(getFilesById, {
      variables: {
        owner: user?.id
      }
    });

  const createUserMutation = gql`
    mutation createUserProfile($user: User_insert_input = { publicKey: ""}) {
      createOneUser(object: $user) {
        id
        publicKey
        username
      }
    }  
  `

  const [createOneUser, { data: createUserData }] = useMutation(createUserMutation);
    
  useEffect(() => {
    if(window != undefined){
      const privateKeyBase64= window.localStorage.getItem("privateKey");
      if(privateKeyBase64 && !keys){
        const privateKey = curve.scalarFromBuffer(Buffer.from(privateKeyBase64, "base64"));
        const publicKey = curve.basepoint.mul(privateKey).toBuffer();
        setKeys({publicKey, privateKey});
      }
    }
  }, [keys, router]);

  useEffect(() => {
    if(usersQueryData){
      setUser(usersQueryData.users[0]);
    }
  }, [usersQueryData]);

  useEffect(() => {
    if(createUserData) {
      setUser(createUserData.createOneUser);
    }
  }, [createUserData])

  useEffect(() => {
    if(filesQueryData){
      setFiles(filesQueryData.files);
      setFilteredFiles(filesQueryData.files);
    }
  }, [filesQueryData, filesQueryError]);

  const download = async(file) => {
    const { data: cipherFile } = await axios({
      method: "GET",
      url: file.s3Url
    });

    pre = new PRE(keys.privateKey.toBuffer(), curve);

    for (const attribute of Object.keys(cipherFile)) {
      const attributeDataArr = Buffer.from(cipherFile[attribute].data);
      cipherFile[attribute]= attributeDataArr;      
    }
    
    let plainFile;
    if (file.shared) {
      plainFile = await pre.reDecrypt(cipherFile);
    } else {
      plainFile = await pre.selfDecrypt(cipherFile);
    }
    const type = file.fileMimeType.split("/")[0];
    const blob = new Blob([plainFile], { type});
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = file.fileName || Math.random();
    a.href = blobUrl;
    a.click();
    URL.revokeObjectURL(blob);
  }

  const openShareModal = (file) => {
    setIsShareModalOpen(true);
    setSelectedFile(file);
    console.log(file);
  }

  const closeShareModel = () => {
    setIsShareModalOpen(false);
    setSelectedFile({});
    setShareAddress();
  }

  const openUploadModal = (file) => {
    setIsUploadModalOpen(true)
  }

  const closeUploadModel = () => {
    setIsUploadModalOpen(false)
    setUploadedFile({});
  }

  const selectFile = async(e) => {
    setUploadedFile(e.target.files[0]);
  };

  const shareFile = async() => {
    if(shareAddress){
      const tag = Buffer.from('TAG');
      const shareAddressBuffer = Buffer.from(shareAddress, "base64");
      const reEncryptionKey = pre.generateReKey(shareAddressBuffer, tag);
      let { data } = await axios.post("/api/share", {
        file: selectedFile,
        reEncryptionKey: reEncryptionKey,
        shareAddress: shareAddressBuffer,
        userId: user.id
      });
      closeShareModel();
    }
  }

  const generateKeys = () => {
    const privateKey = curve.randomScalar();
    const publicKey = curve.basepoint.mul(privateKey).toBuffer();

    if (typeof window !== "undefined") {
      window.localStorage.setItem("privateKey", Buffer.from(privateKey.toBuffer()).toString("base64"));
      console.log(Buffer.from(privateKey.toBuffer()).toString("base64"));
    }
    setKeys({publicKey, privateKey});

    // create keys 
    createOneUser({
      variables: {
        user: {
          publicKey: Buffer.from(publicKey).toString("base64")
        }
      }
    })
  };

  const openAccountDetailModal = (file) => {
    setIsAccountDetailModelOpen(true);
  }

  const closeAccountDetailModal = () => {
    setIsAccountDetailModelOpen(false);
  }
  const uploadFile = async () => {
    // Encrypting the file
    const tag = Buffer.from('TAG');
    const fileBuffer = await uploadedFile.arrayBuffer();
    const cipherFile = await pre.selfEncrypt(fileBuffer, tag);

    setUploadingStatus("Uploading the file to AWS S3");

    const { data: { url } } = await axios.post("/api/s3/uploadFile", {
      name: uploadedFile.name,
    });

    await axios.put(url, cipherFile, {
      headers: {
        "Content-type": "text/javascript",
        "Access-Control-Allow-Origin": "*",
      },
    });
    
    createOneFile({
      variables: {
        fileObject: {
          fileMimeType: uploadedFile.type, 
          fileName: uploadedFile.name,
          owner: user.id, 
          s3Url: BUCKET_URL + uploadedFile.name
        }
      }
    })
    setUploadingStatus("Finished uploading!");
    setUploadedFile(null);
  };

  const filterFiles = () => {
    setFilteredFiles(files.filter((file) => file.fileName.includes(searchKeyword)));
  };

  return (
    <div>
      <Head>
        <title>Base 3.0 Portal | Secure File Storage</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <header className="mx-20">
        <nav className="bg-white border-black-200 py-2.5">
            <div className="flex flex-wrap justify-between items-center">
                <a href="https://sam17.co" className="flex items-center">
                    <Image src="/logo.png" width={50} height={50} className="mr-3 h-6 sm:h-9" alt="Sam. 17 Logo"></Image>
                    <span className="self-center text-xl font-semibold whitespace-nowrap">Base 3.0 Portal</span>
                </a>
                <div className="flex items-center lg:order-2">
                    <button onClick={() => openAccountDetailModal()} className="bg-gray-500 text-white active:bg-gray-600 font-bold uppercase text-sm px-6 py-3 rounded shadow \
                      hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150">{(keys) ? "PK: " + keys?.publicKey.toString("base64").slice(0,5) + "..." : "Sign up"}</button>
                    <button onClick={() => openUploadModal()} className="text-white bg-gray-800 font-bold rounded-lg text-sm px-5 py-bg-gray-500 text-white active:bg-gray-600 font-bold \
                      uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150">Upload new file</button>
                    <button data-collapse-toggle="mobile-menu-2" type="button" className="inline-flex items-center p-2 ml-1 \
                       text-sm text-gray-500 rounded-lg lg:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 \
                       dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600" aria-controls="mobile-menu-2" aria-expanded="false">
                        <span className="sr-only">Open main menu</span>
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"></path></svg>
                        <svg className="hidden w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                    </button>
                </div>
            </div>
        </nav>
       </header>
      <main className="flex flex-col self-center p-4 min-h-screen mx-20" >   
        <div>
          <h1 className="my-10 text-lg">
            <span className="font-bold text-lg">Public Key: </span> {(keys) ? keys?.publicKey.toString("base64") : "No public key yet, login to get a public address!" } 
          </h1>
        </div>
        <div className="mb-3">   
            <label htmlFor="default-search" className="mb-2 text-sm font-medium text-gray-900 sr-only dark:text-gray-300">Search</label>
            <div className="relative">
                <div className="flex absolute inset-y-0 left-0 items-center pl-3 pointer-events-none">
                    <svg aria-hidden="true" className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                <input type="search" onChange={(e) => {setSearchKeyword(e.target.value)}} className="block p-4 pl-10 w-full text-sm text-gray-900 \
                bg-white rounded-lg border border-gray-300" placeholder="Search on file name" required="">
                  </input>
                <button type="submit" className="text-white absolute right-2.5 bottom-2.5 bg-gray-700 hover:bg-gray-800 focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-lg text-sm px-4 py-2" onClick={filterFiles}>Search</button>
            </div>
        </div>

        <table className="table-auto border border-gray-300 rounded-t-lg border-separate">
          <thead className="bg-white-800 text-gray">
            <tr>
              <th className="border border-gray-300 rounded-tl-lg p-2">File Id</th>
              <th className="border border-gray-300 p-2">File Name</th>
              <th className="border border-gray-300 p-2">File Type</th>
              <th className="border border-gray-300 p-2">S3 URL</th>
              <th className="border border-gray-300 p-2">Created At</th>
              <th className="border border-gray-300 p-2">Updated At</th>
              <th className="border border-gray-300 p-2"></th>
              <th className="border border-gray-300 rounded-tr-lg p-2"></th>
            </tr>
          </thead>
          <tbody className="border border border-gray-300 rounded-lg">
            {filteredFiles?.map(
              (file) => 
                <tr key={file.id}>
                  <td className="border border-gray-300 p-2">{file.id}</td>
                  <td className="border border-gray-300 p-2" onClick={() => download(file)}>{file.fileName}</td>
                  <td className="border border-gray-300 p-2">{file.fileMimeType}</td>
                  <td className="border border-gray-300 p-2">{file.s3Url}</td>
                  <td className="border border-gray-300 p-2">{new Date(file.createdAt).toDateString()}</td>
                  <td className="border border-gray-300 p-2">{new Date(file.updatedAt).toDateString()}</td>
                  <td className="border border-gray-300 p-2">
                    <button className="bg-gray-100 hover:bg-gray-300 text-gray-darkest rounded font-bold py-2 px-4 inline-flex items-center" onClick={() => download(file)}>
                      <svg className="w-4 h-4 mr-2 hover:text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z"/></svg>
                      <span>Decrypt</span>
                    </button>
                  </td>
                  {(!file.shared) ? (
                    <td className="border border-gray-300 p-2">
                      <button className="bg-gray-100 hover:bg-gray-300 text-gray-darkest rounded font-bold py-2 px-4 inline-flex items-center" 
                      type="button" onClick={() => openShareModal(file)}>
                        Share
                      </button>
                    </td>
                  ):(<td className="border border-gray-300 p-2"></td>)}
              </tr>
            )}
          </tbody>
        </table>
        {(isShareModalOpen) ? (
          <div className="flex flex-col self-center p-4 min-h-screen justify-center">
            <div className="overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none justify-center items-center" id="modal-id">
              <div className="relative w-auto my-6 mx-auto max-w-3xl flex flex-col self-center p-4 min-h-screen justify-center">
                <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none bg-gray-100">
                  <div className="flex items-start justify-between p-5 border-b border-solid border-slate-200 rounded-t">
                    <h3 className="text-2xl font-semibold text-black">
                      Share file
                    </h3>
                    <button className="p-1 ml-auto bg-transparent border text-black opacity-5 float-right text-3xl leading-none font-semibold outline-none focus:outline-none" onClick={() => closeShareModel()}>
                      <span className="bg-transparent text-black h-6 w-6 text-2xl block outline-none focus:outline-none">
                        ×
                      </span>
                    </button>
                  </div>
                  <div className="relative p-6 flex-auto">
                    <h1 className="mb-5 text-lg">
                      <span className="font-bold text-xl">File: </span> {selectedFile.fileName} 
                    </h1>
                    <label htmlFor="address" className="mb-5 font-bold text-xl">Address: </label>
                    <input type="text" id="address" name="address" className="border border-black bg-white text-black" onChange={(e) => setShareAddress(e.target.value)}></input>
                  </div>
                  <div className="flex items-center justify-end p-6 border-t border-solid border-slate-200 rounded-b">
                    <button className="text-gray-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none \
                     focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button" onClick={() => closeShareModel()}>
                      Close
                    </button>
                    <button className="bg-gray-500 text-white active:bg-gray-600 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button" onClick={shareFile}>
                      Share
                    </button>
                  </div>
                </div>
              </div>
            </div>
          <div className="hidden opacity-25 fixed inset-0 z-40 bg-black" id="modal-id-backdrop"></div>
        </div>
        ):(<> </>)}
        {(isUploadModalOpen) ? (
          <div className="flex flex-col self-center p-4 min-h-screen justify-center">
            <div className="overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none justify-center items-center" id="modal-id">
              <div className="relative w-auto my-6 mx-auto max-w-3xl flex flex-col self-center p-4 min-h-screen justify-center">
                <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none bg-gray-100">
                  <div className="flex items-start justify-between p-5 border-b border-solid border-slate-200 rounded-t">
                    <h3 className="text-2xl font-semibold text-black">
                      Upload file
                    </h3>
                    <button className="p-1 ml-auto bg-transparent border text-black float-right text-3xl leading-none font-semibold outline-none focus:outline-none" onClick={() => closeUploadModel()}>
                      <span className="bg-transparent text-black h-6 w-6 text-2xl block outline-none focus:outline-none">
                        ×
                      </span>
                    </button>
                  </div>
                  <div className="relative p-6 flex-auto self-center">
                  <p>Please select a file to upload</p>
                    <input type="file" onChange={(e) => selectFile(e)} />
                    {uploadingStatus && <p>{uploadingStatus}</p>}
                  </div>
                  <div className="flex items-center justify-end p-6 border-t border-solid border-slate-200 rounded-b">
                    <button className="text-gray-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none \
                     focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button" onClick={() => closeUploadModel()}>
                      Close
                    </button>
                    {uploadedFile && (
                    <button className="bg-gray-500 text-white active:bg-gray-600 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button" onClick={uploadFile}>
                      Upload
                    </button>)}
                  </div>
                </div>
              </div>
            </div>
          <div className="hidden opacity-25 fixed inset-0 z-40 bg-black" id="modal-id-backdrop"></div>
        </div>
        ):(<> </>)}
        {(isAccountDetailModalOpen) ? (
          <div className="flex flex-col self-center p-4 min-h-screen justify-center">
            <div className="overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none justify-center items-center" id="modal-id">
              <div className="relative w-auto my-6 mx-auto max-w-3xl flex flex-col self-center p-4 min-h-screen justify-center">
                <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none bg-gray-100">
                  <div className="flex items-start justify-between p-5 border-b border-solid border-slate-200 rounded-t">
                    <h3 className="text-2xl font-semibold text-black">
                      {(keys)? "Security keys" : "Generate security keys"}
                    </h3>
                    <button className="p-1 ml-auto bg-transparent border text-black float-right text-3xl leading-none font-semibold outline-none focus:outline-none" onClick={() => closeAccountDetailModal()}>
                      <span className="bg-transparent text-black h-6 w-6 text-2xl block outline-none focus:outline-none">
                        ×
                      </span>
                    </button>
                  </div>
                  <div className="relative p-6 flex-auto self-center">
                  {keys?(
                  <>
                    <p>Public key: {Buffer.from(keys?.publicKey).toString("base64")}</p>
                    <p>Private key: {Buffer.from(keys?.privateKey.toBuffer()).toString("base64")}</p>
                    <p className="italic font-bold">Note: the private key should be kept private</p>
                  </>):(<>
                    <button className="bg-gray-500 text-white active:bg-gray-600 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button" onClick={generateKeys}>
                      Create security keys
                    </button>                
                  </>)}
                  </div>
                  <div className="flex items-center justify-end p-6 border-t border-solid border-slate-200 rounded-b">
                    <button className="text-gray-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none \
                     focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button" onClick={() => closeAccountDetailModal()}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          <div className="hidden opacity-25 fixed inset-0 z-40 bg-black" id="modal-id-backdrop"></div>
        </div>
        ):(<> </>)}
      </main>

      <footer className="flex justify-center items-center">
          Powered by {'   '}
          <Image src="/logo.png" width={50} height={50} className="mr-3 h-6 sm:h-9" alt="Sam. 17 Logo"></Image>
      </footer>
    </div>
  )
}
