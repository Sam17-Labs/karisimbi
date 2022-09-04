import { useRouter } from 'next/router'
import { useState } from 'react';
import { curve } from '@futuretense/curve25519-elliptic';
import { useEffect } from 'react';

export default function Account() {
  const [keys, setKeys] = useState();
  let privateKey;
  let publicKey;
  const generateKeys = () => {
    privateKey = curve.randomScalar();
    publicKey = curve.basepoint.mul(privateKey).toBuffer();

    if (typeof window !== "undefined") {
      window.localStorage.setItem("privateKey", Buffer.from(privateKey.toBuffer()));
    }
    setKeys({publicKey, privateKey});
  }

  useEffect(() => {
    if(window?.localStorage.getItem("privateKey") && !keys){
      privateKey = curve.scalarFromBuffer(window.localStorage.getItem("privateKey"));
      publicKey = curve.basepoint.mul(privateKey).toBuffer();
      setKeys({publicKey, privateKey});
    }
  })

  return (
    <div className="container flex items-center p-4 mx-auto min-h-screen justify-center">
      <main>
        {!keys ? (
          <>
            <p>Generate keys to encrypt your files with:</p>
            <button
              onClick={generateKeys}
              className=" bg-purple-500 text-white p-2 rounded-sm shadow-md hover:bg-purple-700 transition-all"
            >
              Generate keys
            </button>
          </>
        ):(
          <>
            <p>Your public address: {Buffer.from(keys.publicKey).toString("base64")} </p>
          </> 
        )}
      </main>
    </div>
  )
}
