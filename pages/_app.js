import '../styles/globals.css';
import client from '../utility/apolloClient';
import { ApolloProvider } from "@apollo/client";
import Head from 'next/head';

function App({ Component, pageProps }) {
  return (
    <ApolloProvider client={client}>
      <Head>
        <title>Karisimbi</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <meta name="description" content="encrypted, secure file storage" />
        <meta
          name="keywords"
          content="encrypted files, secure files, file storage,  storage"
        />
      </Head>
      {/* <Header /> */}
      <Component {...pageProps} />
      {/* <Footer /> */}
    </ApolloProvider>);
}

export default App;
