/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};
module.exports = nextConfig;

module.exports = {
  env: {
    NEXT_PUBLIC_HASURA_URL_HTTP: "https://bright-terrier-15.hasura.app/v1/graphql",
    NEXT_PUBLIC_HASURA_URL_WS: "wss://bright-terrier-15.hasura.app/v1/graphql",
    NEXT_PUBLIC_HASURA_SECRET: "rT5gKsXgxuGwfW9efEdNTjh7P8zb4p31hiLzqpEmmBePhwhI2MRdCTy9Yka5R0lV",
    S3_ACCESS_KEY: "AKIATROEUT35BWMGBJUR",
    S3_SECRET_KEY: "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",
    BUCKET_NAME: "karisimbi-s3-files"
  }
};
